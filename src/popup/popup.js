// Point d'entrée principal du popup.
// Orchestre la collecte de données, le rendu des onglets et l'initialisation des modules.
(() => {
    // Détecte si le popup est chargé dans la sidebar (iframe avec ?mode=sidebar)
    const isSidebarMode = new URLSearchParams(location.search).get('mode') === 'sidebar';
    if (isSidebarMode) {
        document.body.classList.add('sidebar-mode');

        // Crée le dropdown de navigation qui remplace la nav verticale
        const initSidebarDropdown = () => {
            // Récupère tous les onglets visibles (non cachés)
            const tabs = Array.from(document.querySelectorAll('.menu-tab[data-tab]'))
                .filter(btn => btn.style.display !== 'none' && !btn.classList.contains('hidden-tab'));

            const bar = document.createElement('div');
            bar.id = 'sidebar-dropdown-bar';

            const select = document.createElement('select');
            select.id = 'sidebar-tab-select';

            tabs.forEach(btn => {
                const opt = document.createElement('option');
                opt.value = btn.dataset.tab;
                opt.textContent = btn.textContent.trim();
                // Pré-sélectionner l'onglet actif
                if (btn.classList.contains('active')) opt.selected = true;
                select.appendChild(opt);
            });

            // Changer d'onglet via le dropdown
            select.addEventListener('change', () => {
                document.querySelector(`.menu-tab[data-tab="${select.value}"]`)?.click();
            });

            bar.appendChild(select);

            // Insérer entre la topbar et le contenu principal
            const nav = document.querySelector('.header-nav');
            nav?.after(bar);

            // Synchroniser le dropdown quand un onglet change (clic depuis le JS)
            document.querySelectorAll('.menu-tab[data-tab]').forEach(btn => {
                btn.addEventListener('click', () => {
                    select.value = btn.dataset.tab;
                });
            });
        };

        // Attendre que le DOM soit prêt
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initSidebarDropdown);
        } else {
            initSidebarDropdown();
        }
    }

    const STORAGE_KEY = globalThis.DevsourceConstantsV2?.STORAGE_KEYS?.SAVES || 'v2.savedAnalyses';
    const SETTINGS_KEY = globalThis.DevsourceConstantsV2?.STORAGE_KEYS?.SETTINGS || 'v2.settings';
    const MAX_SAVES = globalThis.DevsourceConstantsV2?.MAX_SAVES || 50;
    const DEFAULT_SETTINGS = Object.freeze({ theme: 'light', activeTab: 'tab-overview', hiddenTabs: [] });

    const overviewEl        = document.getElementById('overview-results');
    const auditEl           = document.getElementById('audit-results');
    const speedEl           = document.getElementById('speed-results');
    const opportunitiesEl   = document.getElementById('opportunities-list');
    const wordsEl           = document.getElementById('words-results');
    const metadataEl        = document.getElementById('metadata-results');
    const headingsEl        = document.getElementById('headings-results');
    const linksEl           = document.getElementById('links-results');
    const imagesEl          = document.getElementById('images-results');
    const colorsEl          = document.getElementById('colors-results');
    const structuredDataEl  = document.getElementById('structured-data-results');
    const networkEl         = document.getElementById('network-results');
    const brandEl           = document.getElementById('brand-results');
    const responsiveEl      = document.getElementById('responsive-results');
    const faviconEl         = document.getElementById('favicon-results');
    const technicalEl       = document.getElementById('technical-results');
    const technologiesEl    = document.getElementById('technologies-results');
    const advancedEl        = document.getElementById('advanced-results');
    const capturePreviewWrapEl = document.getElementById('capture-preview-wrap');
    const capturePreviewEl  = document.getElementById('capture-preview');
    const themeToggleEl     = document.getElementById('theme-toggle-input');
    const themeToggleLabelEl = document.getElementById('theme-toggle-label');
    const statusEl          = document.getElementById('status');
    const activeUrlEl       = document.getElementById('active-url');

    let activeTabId = null;
    let lastData = null;
    let lastAuditResult = null;
    let lastNetworkInfo = null;
    let lastRedirectHistory = [];
    let isInitializing = false;
    let settings = { ...DEFAULT_SETTINGS };
    let currentHostname = '';
    let techToolsState = { cssDisabled: false, linksHighlighted: false, nofollowActive: false };

    const NOFOLLOW_STORAGE_KEY = 'v2.advanced.settings';
    const CONTENT_SCRIPT_FILES = Object.freeze(['src/content/collector.js', 'src/content/highlight-nofollow.js']);
    const TABS_NEVER_HIDDEN = new Set(['tab-overview', 'tab-settings']);

    const esc = (v) => globalThis.UtilsV2?.escapeHtml ? globalThis.UtilsV2.escapeHtml(v) : String(v ?? '');
    const setStatus = (text) => { if (statusEl) statusEl.textContent = text; };
    const copyText = async (text) => { if (text) await globalThis.UtilsV2.copyText(text); };
    const switchToTab = (tabId) => document.querySelector(`.menu-tab[data-tab="${tabId}"]`)?.click();

    // Nofollow
    const getNofollowSettings = () => new Promise((resolve) => {
        try {
            chrome.storage.local.get([NOFOLLOW_STORAGE_KEY], (result) => {
                const s = (result?.[NOFOLLOW_STORAGE_KEY] && typeof result[NOFOLLOW_STORAGE_KEY] === 'object') ? result[NOFOLLOW_STORAGE_KEY] : {};
                const globalEnabled = s.highlightNofollow !== false;
                const exclusions = Array.isArray(s.nofollowExclusions) ? s.nofollowExclusions : [];
                resolve({ settings: s, globalEnabled, exclusions, excluded: !!currentHostname && exclusions.includes(currentHostname) });
            });
        } catch (_) { resolve({ settings: {}, globalEnabled: true, exclusions: [], excluded: false }); }
    });

    const updateNofollowTopbarButton = async () => {
        const btn = document.getElementById('btn-nofollow-topbar');
        if (!btn) return;
        if (!currentHostname) { btn.style.display = 'none'; return; }
        const { globalEnabled, excluded } = await getNofollowSettings();
        btn.style.display = 'inline-flex';
        if (!globalEnabled) { btn.textContent = '⚪ Nofollow OFF (global)'; btn.disabled = true; }
        else if (excluded) { btn.textContent = '⚪ Activer ici'; btn.disabled = false; }
        else { btn.textContent = '⚡ Désactiver ici'; btn.disabled = false; }
        techToolsState.nofollowActive = globalEnabled && !excluded;
    };

    const toggleCurrentSiteNofollow = async () => {
        if (!currentHostname) return;
        const { settings: s, globalEnabled, exclusions, excluded } = await getNofollowSettings();
        if (!globalEnabled) { setStatus('Activez d\'abord le surlignage global (onglet Avancé).'); return; }
        const next = excluded ? exclusions.filter((h) => h !== currentHostname) : [...exclusions, currentHostname];
        try {
            chrome.storage.local.set({ [NOFOLLOW_STORAGE_KEY]: { ...s, nofollowExclusions: next } }, () => {
                updateNofollowTopbarButton();
                setStatus(excluded ? `Surlignage activé pour ${currentHostname}.` : `Surlignage désactivé pour ${currentHostname}.`);
            });
        } catch (_) {}
    };

    const setNofollowState = (enabled) => {
        techToolsState.nofollowActive = enabled;
        const adv = document.getElementById('adv-toggle-nofollow');
        if (adv) adv.checked = enabled;
        updateNofollowTopbarButton();
        if (!isInitializing) {
            try { chrome.runtime.sendMessage({ type: 'HIGHLIGHT_NOFOLLOW', enabled }); } catch (_) {}
        }
    };

    // Helpers Chrome API (tabs, scripting, storage, capture)
    const chromeQueryTabs = (queryInfo) => new Promise((resolve, reject) => {
        chrome.tabs.query(queryInfo, (tabs) => {
            if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
            resolve(tabs || []);
        });
    });

    const ensureContentScriptsInjected = (tabId) => new Promise((resolve, reject) => {
        if (!chrome.scripting?.executeScript) { reject(new Error('API scripting indisponible.')); return; }
        chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_SCRIPT_FILES }, () => {
            if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
            resolve();
        });
    });

    const chromeSendMessage = async (tabId, message) => {
        const attempt = () => new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
                resolve(response);
            });
        });
        try { return await attempt(); } catch (err) {
            if (!/Receiving end does not exist/i.test(String(err?.message || ''))) throw err;
            await ensureContentScriptsInjected(tabId);
            return attempt();
        }
    };

    const executeScriptInTab = (tabId, func, args = []) => new Promise((resolve, reject) => {
        if (!chrome.scripting?.executeScript) { reject(new Error('API scripting indisponible')); return; }
        chrome.scripting.executeScript({ target: { tabId }, func, args }, (results) => {
            if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
            resolve(Array.isArray(results) && results[0] ? results[0].result : null);
        });
    });

    const runtimeSendMessage = (message) => new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => resolve(response || {}));
    });

    const captureVisible = () => new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(undefined, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
            resolve(dataUrl);
        });
    });

    const loadImage = (dataUrl) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Impossible de charger la capture.'));
        img.src = dataUrl;
    });

    const storageGet = (key) => new Promise((resolve) => chrome.storage.local.get([key], (r) => resolve(r?.[key])));
    const storageSet = (key, value) => new Promise((resolve) => chrome.storage.local.set({ [key]: value }, resolve));

    const loadSettings = async () => {
        const value = await storageGet(SETTINGS_KEY);
        settings = { ...DEFAULT_SETTINGS, ...(value && typeof value === 'object' ? value : {}) };
    };
    const saveSettings = async () => storageSet(SETTINGS_KEY, settings);

    const applyTheme = (theme) => {
        const next = theme === 'dark' ? 'dark' : 'light';
        document.body.classList.toggle('theme-dark', next === 'dark');
        document.body.classList.toggle('dark-mode', next === 'dark');
        if (themeToggleEl) themeToggleEl.checked = next === 'dark';
        if (themeToggleLabelEl) themeToggleLabelEl.textContent = next === 'dark' ? 'Mode sombre' : 'Mode clair';
    };

    // Collecte les données SEO de l'onglet actif via le content script
    const collectTabData = async () => {
        const tabs = await chromeQueryTabs({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (!tab?.id || !tab.url?.startsWith('http')) { setStatus('Page non analysable.'); return null; }
        activeTabId = tab.id;
        try { currentHostname = new URL(tab.url).hostname; } catch (_) { currentHostname = ''; }
        if (activeUrlEl) activeUrlEl.textContent = tab.url;
        updateNofollowTopbarButton();
        setStatus('Analyse en cours...');
        const response = await chromeSendMessage(tab.id, { type: 'COLLECT_DATA' });
        if (!response || response.success === false) throw new Error(response?.error || 'Erreur de collecte.');
        return globalThis.PageDataV2?.createPageData ? globalThis.PageDataV2.createPageData(response.data) : response.data;
    };

    // Fonctions de rendu des différents onglets
    const renderOverview = (data) => globalThis.PopupOverviewV2?.render(overviewEl, data);

    const renderModules = (data) => {
        renderAuditPanel(data);
        renderSpeed(data);
        renderWords(data);
        renderOpportunities(data);
        globalThis.MetadataModuleV2?.render(metadataEl, data);
        globalThis.HeadingsModuleV2?.render(headingsEl, data);
        globalThis.LinksModuleV2?.render(linksEl, data);
        globalThis.ImagesModuleV2?.render(imagesEl, data);
        globalThis.PopupColorsV2?.render(colorsEl, data);
        globalThis.StructuredDataModuleV2?.render(structuredDataEl, data);
        globalThis.PopupTechnicalV2?.renderTechnical(technicalEl, data);
        globalThis.PopupTechnicalV2?.renderTechnologies(technologiesEl, data);
        globalThis.AdvancedModuleV2?.render(advancedEl, data);
        globalThis.BrandModuleV2?.render(brandEl, data, { onPrintPdf: () => globalThis.PopupCaptureV2?.run('pdf') });
        globalThis.ResponsiveModuleV2?.render(responsiveEl, data);
        globalThis.FaviconModuleV2?.render(faviconEl, data);
    };

    const renderAuditPanel = (data) => {
        if (!auditEl) return;
        if (lastAuditResult) { globalThis.AuditRendererV2?.render(auditEl, lastAuditResult); return; }
        auditEl.innerHTML = `
            <div class="audit-launch-card">
                <div class="audit-launch-copy">
                    <div class="audit-launch-kicker">Audit SEO</div>
                    <h3>Prêt à lancer l'analyse</h3>
                    <p class="panel-note">Le score et les recommandations seront calculés seulement quand tu cliques sur le bouton.</p>
                </div>
                <button id="btn-run-audit" class="btn btn-primary">Lancer l'analyse</button>
            </div>
            <div class="audit-empty-state">Aucun audit lancé pour l'instant.</div>`;
    };

    const runAuditAnalysis = () => {
        if (!lastData) { setStatus('Aucune page à auditer.'); return; }
        lastAuditResult = globalThis.AuditControllerV2?.analyze ? globalThis.AuditControllerV2.analyze(lastData) : null;
        if (!lastAuditResult) { setStatus('Audit indisponible.'); return; }
        globalThis.AuditRendererV2?.render(auditEl, lastAuditResult);
        renderOverview(lastData);
        renderOpportunities(lastData);
        setStatus('Audit terminé.');
    };

    const renderSpeed = (data) => {
        if (!speedEl) return;
        const timing = data.performanceTiming || { ttfb: 0, domReady: 0, load: 0 };
        speedEl.innerHTML = `
            <div class="card legacy-banner">
                <div class="card-header split">
                    <h3>Vitesse Locale (Sans API)</h3>
                    <button id="btn-check-speed" class="btn btn-primary">Mesurer Maintenant</button>
                </div>
                <p class="panel-note">Mesure la vitesse réelle ressentie par votre navigateur.</p>
                <div class="speed-grid">
                    <div class="speed-card"><span class="speed-value">${timing.ttfb || 0} ms</span><span class="speed-label">TTFB (Serv)</span></div>
                    <div class="speed-card"><span class="speed-value">${timing.domReady || 0} ms</span><span class="speed-label">DOM Ready</span></div>
                    <div class="speed-card"><span class="speed-value">${timing.load || 0} ms</span><span class="speed-label">Full Load</span></div>
                </div>
            </div>
            <div class="card" style="margin-top:15px;">
                <div class="card-header split">
                    <h3>Google PageSpeed Insights (API)</h3>
                    <button id="btn-run-psi" class="btn btn-secondary">Lancer Analyse API</button>
                </div>
                <p class="panel-note">A brancher avec votre clé API Google si besoin.</p>
                <div class="config-group" style="margin-bottom:15px;">
                    <label for="google-api-key" style="font-weight:bold;display:block;margin-bottom:5px;">Clé API Google :</label>
                    <input type="password" id="google-api-key" placeholder="Collez votre clé API Google ici" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:4px;">
                </div>
                <div id="psi-loading" class="panel-note" style="display:none;">Analyse en cours...</div>
                <div id="psi-results" class="advanced-box">Aucune analyse PSI lancée.</div>
            </div>`;
    };

    const measureSpeedNow = async () => {
        try {
            setStatus('Mesure vitesse en cours...');
            const data = await collectTabData();
            if (!data) { setStatus('Mesure indisponible sur cette page.'); return; }
            lastData = lastData ? { ...lastData, performanceTiming: data.performanceTiming || lastData.performanceTiming } : data;
            renderSpeed(lastData);
            setStatus('Mesure vitesse mise à jour.');
        } catch (err) { setStatus(`Mesure speed échouée: ${err?.message || 'erreur inconnue'}`); }
    };

    const renderWords = (data) => { if (wordsEl) globalThis.WordsModuleV2?.render(wordsEl, data, { setStatus }); };

    const renderOpportunities = () => {
        if (!opportunitiesEl) return;
        if (!lastAuditResult) {
            opportunitiesEl.innerHTML = '<div class="advanced-box">Lance l\'audit pour voir les opportunités SEO.</div>';
            return;
        }
        const opps = Array.isArray(lastAuditResult.items) ? lastAuditResult.items.filter((i) => i.status !== 'ok') : [];
        opportunitiesEl.innerHTML = opps.length
            ? opps.map((opp) => `<div class="opp-item opp-${opp.status === 'error' ? 'critical' : opp.status === 'warning' ? 'warning' : 'info'}"><span class="opp-score">${esc(String(opp.weight || ''))}</span><span class="opp-msg">${esc(opp.message)}</span></div>`).join('')
            : '<div class="opp-item opp-success"><span class="opp-score">:)</span><span class="opp-msg">Aucune opportunité critique détectée. Bon travail !</span></div>';
    };

    const renderNetwork = async () => {
        if (!networkEl || !lastData) return;
        const [networkInfoResponse, redirectHistoryResponse] = await Promise.all([
            runtimeSendMessage({ type: 'GET_NETWORK_INFO', url: lastData.url, tabId: activeTabId }),
            runtimeSendMessage({ type: 'GET_REDIRECT_HISTORY' })
        ]);
        lastNetworkInfo = networkInfoResponse || {};
        lastRedirectHistory = Array.isArray(redirectHistoryResponse?.history) ? redirectHistoryResponse.history : [];
        globalThis.RedirectsModuleV2?.render(networkEl, lastNetworkInfo, lastRedirectHistory);
        // Mise à jour IP/CDN dans l'aperçu sans re-render complet
        const ipEl = overviewEl?.querySelector('#net-ip');
        const cdnEl = overviewEl?.querySelector('#net-cdn');
        if (ipEl) ipEl.textContent = lastNetworkInfo?.ip || 'N/A';
        if (cdnEl) cdnEl.textContent = lastNetworkInfo?.cdn || 'N/A';
    };

    // Bulk opener : ouvre plusieurs URLs en même temps
    const parseBulkEntryToUrl = (line) => {
        const v = String(line || '').trim();
        if (!v) return '';
        if (/^https?:\/\//i.test(v)) return v;
        if (/\s/.test(v)) return `https://www.google.com/search?q=${encodeURIComponent(v)}`;
        if (/^[\w.-]+\.[a-z]{2,}$/i.test(v)) return `https://${v}`;
        return `https://www.google.com/search?q=${encodeURIComponent(v)}`;
    };
    const getBulkUrls = () => {
        const raw = String(document.getElementById('bulk-opener-input')?.value || '');
        const urls = raw.split(/\r?\n/).map((l) => parseBulkEntryToUrl(l.trim())).filter(Boolean);
        return globalThis.UtilsV2?.unique ? globalThis.UtilsV2.unique(urls) : Array.from(new Set(urls));
    };
    const updateBulkCount = () => {
        const el = document.getElementById('bulk-url-count');
        if (el) el.textContent = `${getBulkUrls().length} URL(s)`;
    };
    const openBulkUrls = async () => {
        const urls = getBulkUrls();
        if (!urls.length) { setStatus('Aucune URL à ouvrir.'); return; }
        urls.slice(0, 50).forEach((url) => { try { chrome.tabs.create({ url }); } catch (_) {} });
        setStatus(`${Math.min(urls.length, 50)} onglet(s) ouvert(s).`);
    };

    // Gestion des onglets et du panneau de paramètres
    const applyHiddenTabs = () => {
        const hidden = Array.isArray(settings.hiddenTabs) ? settings.hiddenTabs : [];
        Array.from(document.querySelectorAll('.menu-tab[data-tab]')).forEach((btn) => {
            const id = btn.getAttribute('data-tab');
            btn.style.display = (hidden.includes(id) && !TABS_NEVER_HIDDEN.has(id)) ? 'none' : '';
        });
    };

    const bindTabs = () => {
        const tabs = Array.from(document.querySelectorAll('.menu-tab'));
        const panels = Array.from(document.querySelectorAll('.tab-panel'));
        const activateTab = (target) => {
            tabs.forEach((t) => t.classList.toggle('active', t.getAttribute('data-tab') === target));
            panels.forEach((p) => p.classList.toggle('active', p.id === target));
            settings.activeTab = target;
            saveSettings();
        };
        tabs.forEach((tab) => tab.addEventListener('click', () => activateTab(tab.getAttribute('data-tab'))));
        applyHiddenTabs();
        const hidden = Array.isArray(settings.hiddenTabs) ? settings.hiddenTabs : [];
        const exists = panels.some((p) => p.id === settings.activeTab && !hidden.includes(p.id));
        activateTab(exists ? settings.activeTab : DEFAULT_SETTINGS.activeTab);
    };

    const bindSettingsTab = () => {
        const container = document.getElementById('settings-tabs-list');
        if (!container) return;
        const allTabBtns = Array.from(document.querySelectorAll('.menu-tab[data-tab]'));
        const hidden = Array.isArray(settings.hiddenTabs) ? [...settings.hiddenTabs] : [];

        const rebuild = () => {
            container.innerHTML = allTabBtns
                .filter((btn) => !TABS_NEVER_HIDDEN.has(btn.getAttribute('data-tab')))
                .map((btn) => {
                    const id = btn.getAttribute('data-tab');
                    return `<label class="settings-tab-toggle" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;user-select:none;">
                        <input type="checkbox" data-settings-tab="${id}" ${!hidden.includes(id) ? 'checked' : ''} style="accent-color:var(--accent,#f1fd0d);width:15px;height:15px;cursor:pointer;">
                        <span>${btn.textContent.trim()}</span>
                    </label>`;
                }).join('');

            container.querySelectorAll('input[data-settings-tab]').forEach((cb) => {
                cb.addEventListener('change', () => {
                    const id = cb.getAttribute('data-settings-tab');
                    if (cb.checked) { const i = hidden.indexOf(id); if (i !== -1) hidden.splice(i, 1); }
                    else if (!hidden.includes(id)) hidden.push(id);
                    settings.hiddenTabs = [...hidden];
                    saveSettings();
                    applyHiddenTabs();
                    if (!cb.checked && settings.activeTab === id) document.querySelector('.menu-tab[data-tab="tab-overview"]')?.click();
                });
            });
        };

        rebuild();
        document.getElementById('btn-settings-show-all')?.addEventListener('click', () => {
            hidden.length = 0; settings.hiddenTabs = []; saveSettings(); applyHiddenTabs(); rebuild();
        });
        document.getElementById('btn-settings-hide-all')?.addEventListener('click', () => {
            allTabBtns.forEach((btn) => { const id = btn.getAttribute('data-tab'); if (!TABS_NEVER_HIDDEN.has(id) && !hidden.includes(id)) hidden.push(id); });
            settings.hiddenTabs = [...hidden]; saveSettings(); applyHiddenTabs(); rebuild();
            if (settings.hiddenTabs.includes(settings.activeTab)) document.querySelector('.menu-tab[data-tab="tab-overview"]')?.click();
        });
    };

    // Initialise tous les modules avec un contexte partagé
    const initModules = () => {
        const sharedCtx = {
            setStatus,
            copyText,
            switchToTab,
            NOFOLLOW_STORAGE_KEY,
            STORAGE_KEY,
            MAX_SAVES,
            techToolsState,
            getActiveTabId: () => activeTabId,
            getLastData: () => lastData,
            getLastAuditResult: () => lastAuditResult,
            getLastNetworkInfo: () => lastNetworkInfo,
            sendMessage: chromeSendMessage,
            executeScript: executeScriptInTab,
            captureVisible,
            loadImage,
            storageGet,
            storageSet,
            toggleCurrentSiteNofollow,
            updateNofollowTopbarButton,
            rerenderColors: () => { if (lastData) globalThis.PopupColorsV2?.render(colorsEl, lastData); },
            rerenderTechnical: () => globalThis.PopupTechnicalV2?.renderTechnical(technicalEl, lastData || {}),
            onCapture: (dataUrl) => {
                if (capturePreviewEl && capturePreviewWrapEl) {
                    capturePreviewEl.src = dataUrl;
                    capturePreviewWrapEl.classList.remove('hidden');
                }
            }
        };
        globalThis.PopupOverviewV2?.init(sharedCtx);
        globalThis.PopupColorsV2?.init(sharedCtx);
        globalThis.PopupCaptureV2?.init(sharedCtx);
        globalThis.PopupSavesV2?.init(sharedCtx);
        globalThis.PopupTechnicalV2?.init(sharedCtx);
    };

    // Binding de tous les boutons et actions de l'interface
    const bindActions = () => {
        document.getElementById('btn-save-analysis')?.addEventListener('click', () => globalThis.PopupSavesV2?.save());
        document.getElementById('btn-refresh')?.addEventListener('click', loadCurrentPage);
        document.getElementById('btn-run-audit')?.addEventListener('click', runAuditAnalysis);
        document.getElementById('btn-export-saves')?.addEventListener('click', () => globalThis.PopupSavesV2?.exportAll());
        document.getElementById('btn-clear-saves')?.addEventListener('click', () => globalThis.PopupSavesV2?.clear());
        document.getElementById('btn-capture-png')?.addEventListener('click', () => globalThis.PopupCaptureV2?.run('png'));
        document.getElementById('btn-capture-pdf')?.addEventListener('click', () => globalThis.PopupCaptureV2?.run('pdf'));
        document.getElementById('btn-bulk-open-all')?.addEventListener('click', openBulkUrls);
        document.getElementById('btn-bulk-clear')?.addEventListener('click', () => {
            const el = document.getElementById('bulk-opener-input');
            if (el) el.value = '';
            updateBulkCount();
            setStatus('Liste bulk vidée.');
        });
        document.getElementById('bulk-opener-input')?.addEventListener('input', updateBulkCount);
        document.getElementById('bulk-open-meet')?.addEventListener('click', () => chrome.tabs.create({ url: 'https://meet.google.com' }));
        document.getElementById('bulk-open-sheet')?.addEventListener('click', () => chrome.tabs.create({ url: 'https://sheets.new' }));
        document.getElementById('bulk-open-doc')?.addEventListener('click', () => chrome.tabs.create({ url: 'https://docs.new' }));
        document.getElementById('btn-nofollow-topbar')?.addEventListener('click', toggleCurrentSiteNofollow);
        updateBulkCount();

        themeToggleEl?.addEventListener('change', async () => {
            settings.theme = themeToggleEl.checked ? 'dark' : 'light';
            applyTheme(settings.theme);
            await saveSettings();
            setStatus('Préférence enregistrée.');
        });

        document.addEventListener('click', (e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.id === 'btn-run-audit') { runAuditAnalysis(); return; }
            if (target.closest('#btn-check-speed')) { measureSpeedNow(); }
        });
        document.getElementById('btn-open-sidebar')?.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;
        await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
        window.close(); // ferme le popup
});
    };

    // Charge et affiche les données de la page active
    const loadCurrentPage = async () => {
        try {
            const data = await collectTabData();
            if (!data) return;
            lastData = data;
            lastAuditResult = null;
            renderOverview(data);
            renderModules(data);
            await renderNetwork();
            setStatus('Analyse terminée.');
        } catch (err) {
            setStatus(`Erreur: ${err?.message || 'inconnue'}`);
        }
    };

    // Point d'entrée principal
    const init = async () => {
        if (!globalThis.chrome?.tabs || !globalThis.chrome?.storage) {
            setStatus('Environnement extension non supporté.');
            return;
        }
        window.addEventListener('ds:nofollowChanged', (e) => {
            const enabled = Boolean(e.detail?.enabled);
            setNofollowState(enabled);
            if (!isInitializing && activeTabId) chromeSendMessage(activeTabId, { type: 'SET_NOFOLLOW_HIGHLIGHT', enabled }).catch(() => {});
            setStatus(enabled ? 'Surlignage nofollow activé.' : 'Surlignage nofollow désactivé.');
        });

        isInitializing = true;
        await loadSettings();
        isInitializing = false;
        applyTheme(settings.theme);
        initModules();
        bindTabs();
        bindSettingsTab();
        bindActions();
        globalThis.LinkingControllerV2?.init({ setStatus });
        await globalThis.PopupSavesV2?.refresh();
        await loadCurrentPage();
    };

    init();
})();
