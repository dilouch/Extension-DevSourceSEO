(() => {
    const STORAGE_KEY = globalThis.DevsourceConstantsV2?.STORAGE_KEYS?.SAVES || 'v2.savedAnalyses';
    const SETTINGS_KEY = globalThis.DevsourceConstantsV2?.STORAGE_KEYS?.SETTINGS || 'v2.settings';
    const MAX_SAVES = globalThis.DevsourceConstantsV2?.MAX_SAVES || 50;
    const DEFAULT_SETTINGS = Object.freeze({
        theme: 'light',
        activeTab: 'tab-overview'
    });
    const BRAND_PALETTE_EXCLUDED = Object.freeze(new Set([
        '#283A3B',
        '#FFFFFF',
        '#000000',
        '#12272B',
        '#1A3638',
        '#F5D002',
        '#CCD6DF',
        '#F1FD0D',
        '#F0F3F1'
    ]));

    const statusEl = document.getElementById('status');
    const activeUrlEl = document.getElementById('active-url');
    const overviewEl = document.getElementById('overview-results');
    const auditEl = document.getElementById('audit-results');
    const speedEl = document.getElementById('speed-results');
    const opportunitiesEl = document.getElementById('opportunities-list');
    const wordsEl = document.getElementById('words-results');
    const metadataEl = document.getElementById('metadata-results');
    const headingsEl = document.getElementById('headings-results');
    const linksEl = document.getElementById('links-results');
    const imagesEl = document.getElementById('images-results');
    const colorsEl = document.getElementById('colors-results');
    const structuredDataEl = document.getElementById('structured-data-results');
    const linkingEl = document.getElementById('linking-results');
    const bulkLinkingEl = document.getElementById('bulk-linking-results');
    const savedListEl = document.getElementById('saved-list');
    const capturePreviewWrapEl = document.getElementById('capture-preview-wrap');
    const capturePreviewEl = document.getElementById('capture-preview');
    const brandEl = document.getElementById('brand-results');
    const responsiveEl = document.getElementById('responsive-results');
    const networkEl = document.getElementById('network-results');
    const faviconEl = document.getElementById('favicon-results');
    const technicalEl = document.getElementById('technical-results');
    const technologiesEl = document.getElementById('technologies-results');
    const advancedEl = document.getElementById('advanced-results');
    const themeToggleEl = document.getElementById('theme-toggle-input');
    const themeToggleLabelEl = document.getElementById('theme-toggle-label');

    let activeTabId = null;
    let lastData = null;
    let lastAuditResult = null;
    let lastNetworkInfo = null;
    let lastRedirectHistory = [];
    let pickedColors = [];
    let techToolsState = {
        cssDisabled: false,
        linksHighlighted: false,
        nofollowActive: false
    };
    let isInitializing = false;
    let settings = { ...DEFAULT_SETTINGS };

    const esc = (value) => globalThis.UtilsV2?.escapeHtml
        ? globalThis.UtilsV2.escapeHtml(value)
        : String(value ?? '');

    const CONTENT_SCRIPT_FILES = Object.freeze([
        'src/content/collector.js',
        'src/content/highlight-nofollow.js'
    ]);

    const setStatus = (text) => {
        if (statusEl) statusEl.textContent = text;
    };

    // ── Nofollow highlight state ────────────────────────────────────────────────
    let currentHostname = '';
    const NOFOLLOW_STORAGE_KEY = 'v2.advanced.settings';

    const getNofollowSettings = () => new Promise((resolve) => {
        try {
            chrome.storage.local.get([NOFOLLOW_STORAGE_KEY], (result) => {
                const settings = (result?.[NOFOLLOW_STORAGE_KEY] && typeof result[NOFOLLOW_STORAGE_KEY] === 'object') ? result[NOFOLLOW_STORAGE_KEY] : {};
                const globalEnabled = settings.highlightNofollow !== false;
                const exclusions = Array.isArray(settings.nofollowExclusions) ? settings.nofollowExclusions : [];
                resolve({ settings, globalEnabled, exclusions, excluded: !!currentHostname && exclusions.includes(currentHostname) });
            });
        } catch (_) { resolve({ settings: {}, globalEnabled: true, exclusions: [], excluded: false }); }
    });

    const updateNofollowTopbarButton = async () => {
        const btn = document.getElementById('btn-nofollow-topbar');
        if (!btn) return;
        if (!currentHostname) {
            btn.style.display = 'none';
            return;
        }
        const { globalEnabled, excluded } = await getNofollowSettings();
        btn.style.display = 'inline-flex';
        if (!globalEnabled) {
            btn.textContent = '⚪ Nofollow OFF (global)';
            btn.disabled = true;
            btn.title = 'Réactivez le surlignage dans l\'onglet Avancé';
        } else if (excluded) {
            btn.textContent = '⚪ Activer ici';
            btn.disabled = false;
            btn.title = `Réactiver le surlignage pour ${currentHostname}`;
        } else {
            btn.textContent = '⚡ Désactiver ici';
            btn.disabled = false;
            btn.title = `Désactiver le surlignage pour ${currentHostname}`;
        }
        techToolsState.nofollowActive = globalEnabled && !excluded;
    };

    const toggleCurrentSiteNofollow = async () => {
        if (!currentHostname) return;
        const { settings, globalEnabled, exclusions, excluded } = await getNofollowSettings();
        if (!globalEnabled) {
            setStatus('Activez d\'abord le surlignage global (onglet Avancé).');
            return;
        }
        const next = excluded
            ? exclusions.filter((h) => h !== currentHostname)
            : [...exclusions, currentHostname];
        const newSettings = { ...settings, nofollowExclusions: next };
        try {
            chrome.storage.local.set({ [NOFOLLOW_STORAGE_KEY]: newSettings }, () => {
                updateNofollowTopbarButton();
                setStatus(excluded ? `Surlignage activé pour ${currentHostname}.` : `Surlignage désactivé pour ${currentHostname}.`);
            });
        } catch (_) {}
    };

    // Compatibilité legacy : conserve la signature pour le toggle global de l'onglet Avancé
    const setNofollowState = (enabled) => {
        techToolsState.nofollowActive = enabled;
        const advToggle = document.getElementById('adv-toggle-nofollow');
        if (advToggle) advToggle.checked = enabled;
        updateNofollowTopbarButton();
        if (!isInitializing) {
            try { chrome.runtime.sendMessage({ type: 'HIGHLIGHT_NOFOLLOW', enabled }); } catch (_) {}
        }
    };

    const chromeQueryTabs = (queryInfo) => new Promise((resolve, reject) => {
        chrome.tabs.query(queryInfo, (tabs) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(tabs || []);
        });
    });

    const ensureContentScriptsInjected = (tabId) => new Promise((resolve, reject) => {
        if (!chrome.scripting?.executeScript) {
            reject(new Error('API scripting indisponible.'));
            return;
        }

        chrome.scripting.executeScript(
            {
                target: { tabId },
                files: CONTENT_SCRIPT_FILES
            },
            () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve();
            }
        );
    });

    const chromeSendMessage = async (tabId, message) => {
        const attemptSend = () => new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(response);
            });
        });

        try {
            return await attemptSend();
        } catch (err) {
            const msg = String(err?.message || '');
            if (!/Receiving end does not exist/i.test(msg)) {
                throw err;
            }

            await ensureContentScriptsInjected(tabId);
            return attemptSend();
        }
    };

    const executeScriptInTab = (tabId, func, args = []) => new Promise((resolve, reject) => {
        if (!chrome.scripting?.executeScript) {
            reject(new Error('API scripting indisponible'));
            return;
        }

        chrome.scripting.executeScript(
            {
                target: { tabId },
                func,
                args
            },
            (results) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                const result = Array.isArray(results) && results[0] ? results[0].result : null;
                resolve(result);
            }
        );
    });

    const runtimeSendMessage = (message) => new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => resolve(response || {}));
    });

    const captureVisible = () => new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(undefined, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(dataUrl);
        });
    });

    const loadImage = (dataUrl) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Impossible de charger la capture.'));
        img.src = dataUrl;
    });

    const storageGet = (key) => new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => resolve(result?.[key]));
    });

    const storageSet = (key, value) => new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
    });

    const loadSettings = async () => {
        const value = await storageGet(SETTINGS_KEY);
        settings = {
            ...DEFAULT_SETTINGS,
            ...(value && typeof value === 'object' ? value : {})
        };
    };

    const saveSettings = async () => {
        await storageSet(SETTINGS_KEY, settings);
    };

    const applyTheme = (theme) => {
        const nextTheme = theme === 'dark' ? 'dark' : 'light';
        document.body.classList.toggle('theme-dark', nextTheme === 'dark');
        document.body.classList.toggle('dark-mode', nextTheme === 'dark');
        if (themeToggleEl) themeToggleEl.checked = nextTheme === 'dark';
        if (themeToggleLabelEl) {
            themeToggleLabelEl.textContent = nextTheme === 'dark' ? 'Mode sombre' : 'Mode clair';
        }
    };

    const openPrintTabForPdf = (dataUrl) => {
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Capture</title><style>body{margin:0;background:#fff}img{display:block;width:100%;height:auto}@media print{@page{size:auto;margin:0}}</style></head><body><img src="${dataUrl}" alt="capture"><script>window.onload=()=>setTimeout(()=>window.print(),200);</script></body></html>`;
        const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
        chrome.tabs.create({ url });
    };

    const copyText = async (text) => {
        if (!text) return;
        await globalThis.UtilsV2.copyText(text);
    };

    const normalizeColor = (value) => {
        const source = String(value || '').trim();
        if (!source) return '';
        if (source.startsWith('#')) return source.toUpperCase();
        const hex = globalThis.UtilsV2?.rgbToHex ? globalThis.UtilsV2.rgbToHex(source) : source.toUpperCase();
        // Garantir le préfixe #
        return hex && !hex.startsWith('#') ? `#${hex}` : hex;
    };

    const mergeColorData = (data) => {
        const base = data?.colors && typeof data.colors === 'object' ? data.colors : {};
        const baseText = Array.isArray(base.text) ? base.text : [];
        const baseBackground = Array.isArray(base.background) ? base.background : [];
        const baseAll = Array.isArray(base.all) ? base.all : [];
        const picked = pickedColors.map((item) => normalizeColor(item)).filter(Boolean);
        const all = globalThis.UtilsV2?.unique
            ? globalThis.UtilsV2.unique([...picked, ...baseAll])
            : Array.from(new Set([...picked, ...baseAll]));

        return {
            ...data,
            colors: {
                text: baseText,
                background: baseBackground,
                all
            }
        };
    };

    const clearPickedColors = () => {
        pickedColors = [];
        if (lastData) {
            renderColors(lastData);
        }
        setStatus('Couleurs capturees videes.');
    };

    const startColorPicker = async () => {
        if (!activeTabId) {
            setStatus('Onglet actif introuvable.');
            return null;
        }

        try {
            const inTabEyeDropper = await executeScriptInTab(activeTabId, async () => {
                if (!window.EyeDropper) {
                    return { success: false, reason: 'unsupported' };
                }
                try {
                    const res = await new EyeDropper().open();
                    const color = res?.sRGBHex || '';
                    // Copier dans le presse-papier depuis le contexte de la page (qui a le focus)
                    let copied = false;
                    if (color) {
                        try {
                            await navigator.clipboard.writeText(color.toUpperCase());
                            copied = true;
                        } catch (_e) {
                            // Fallback execCommand
                            try {
                                const ta = document.createElement('textarea');
                                ta.value = color.toUpperCase();
                                ta.style.position = 'fixed';
                                ta.style.opacity = '0';
                                document.body.appendChild(ta);
                                ta.select();
                                copied = document.execCommand('copy');
                                document.body.removeChild(ta);
                            } catch (_e2) { /* ignore */ }
                        }
                    }
                    return { success: true, color, copied };
                } catch (error) {
                    return {
                        success: false,
                        reason: 'aborted',
                        message: String(error?.message || '')
                    };
                }
            });

            if (inTabEyeDropper?.success && inTabEyeDropper?.color) {
                const hex = normalizeColor(inTabEyeDropper.color);
                const merged = [hex, ...pickedColors].filter(Boolean);
                pickedColors = globalThis.UtilsV2?.unique ? globalThis.UtilsV2.unique(merged).slice(0, 20) : Array.from(new Set(merged)).slice(0, 20);
                if (lastData) renderColors(lastData);
                if (inTabEyeDropper.copied) {
                    setStatus(`✅ Couleur copiée: ${hex}`);
                } else {
                    // Fallback : tenter dans le contexte du popup
                    try { await copyText(hex); setStatus(`✅ Couleur copiée: ${hex}`); }
                    catch (_) { setStatus(`Couleur capturée: ${hex} (copie impossible)`); }
                }
                return hex;
            }
        } catch (_err) {
            // Ignore et tente les autres chemins.
        }

        try {
            if (globalThis.ColorsModuleV2?.activateEyeDropper) {
                const eyeDropperHex = await globalThis.ColorsModuleV2.activateEyeDropper();
                if (eyeDropperHex) {
                    const merged = [eyeDropperHex, ...pickedColors].filter(Boolean);
                    pickedColors = globalThis.UtilsV2?.unique ? globalThis.UtilsV2.unique(merged).slice(0, 20) : Array.from(new Set(merged)).slice(0, 20);
                    if (lastData) renderColors(lastData);
                    try { await copyText(eyeDropperHex); setStatus(`Couleur capturée et copiée: ${eyeDropperHex}`); }
                    catch (_) { setStatus(`Couleur capturée: ${eyeDropperHex} (copie impossible)`); }
                    return eyeDropperHex;
                }
            }
        } catch (_err) {
            // Fallback en cas d'annulation ou d'incompatibilite EyeDropper.
        }

        setStatus('Pipette active: clique une couleur sur la page.');
        try {
            const response = await chromeSendMessage(activeTabId, { type: 'START_COLOR_PICKER' });
            if (!response?.success || !response?.color) {
                setStatus(response?.canceled ? 'Pipette annulee.' : 'Aucune couleur capturee.');
                return null;
            }

            const color = normalizeColor(response.color);
            if (!color) {
                setStatus('Couleur non exploitable.');
                return null;
            }

            const merged = [color, ...pickedColors].filter(Boolean);
            pickedColors = globalThis.UtilsV2?.unique ? globalThis.UtilsV2.unique(merged).slice(0, 20) : Array.from(new Set(merged)).slice(0, 20);

            if (lastData) {
                renderColors(lastData);
            }
            try { await copyText(color); setStatus(`Couleur capturée et copiée: ${color}`); }
            catch (_) { setStatus(`Couleur capturée: ${color} (copie impossible)`); }
            return color;
        } catch (err) {
            setStatus(`Pipette indisponible: ${err?.message || 'erreur inconnue'}`);
            return null;
        }
    };

    const renderColors = (data) => {
        if (!colorsEl || !data) return;
        const mergedData = mergeColorData(data);

        const container = colorsEl.querySelector('.color-tools-container');
        const picker = document.getElementById('color-picker-input');
        const swatchesWrap = document.getElementById('colors-detected-list');
        if (!container || !picker || !swatchesWrap) return;

        const toHex = (value) => {
            const source = String(value || '').trim();
            if (!source) return '';
            if (source.startsWith('#')) {
                const raw = source.slice(1);
                if (raw.length === 3) {
                    return `#${raw.split('').map((char) => `${char}${char}`).join('')}`.toUpperCase();
                }
                if (raw.length === 6) return `#${raw}`.toUpperCase();
                return source.toUpperCase();
            }
            return normalizeColor(source);
        };

        const allColors = Array.isArray(mergedData.colors?.all) ? mergedData.colors.all : [];
        const normalized = allColors.map((color) => toHex(color)).filter((color) => /^#[0-9A-F]{6}$/i.test(color));
        const deduped = globalThis.UtilsV2?.unique ? globalThis.UtilsV2.unique(normalized) : Array.from(new Set(normalized));
        const filtered = deduped.filter((hex) => !BRAND_PALETTE_EXCLUDED.has(hex));

        if (filtered.length) {
            picker.value = filtered[0];
            swatchesWrap.innerHTML = filtered.slice(0, 18).map((hex) => `
                <button type="button" class="swatch" data-color="${hex}" title="Appliquer ${hex}">
                    <span class="swatch-chip" style="background:${hex}"></span>
                    <span class="swatch-meta">
                        <span class="swatch-code">${hex}</span>
                        <span class="swatch-label">Appliquer</span>
                    </span>
                </button>
            `).join('');
        } else {
            swatchesWrap.innerHTML = '<div class="hint">Aucune couleur detectee.</div>';
        }

        if (globalThis.ColorsManager?.init && !document.getElementById('ds-advanced-colors-ui')) {
            globalThis.ColorsManager.init();
        }

        if (globalThis.ColorsManager?.updateAll && /^#[0-9A-F]{6}$/i.test(picker.value)) {
            globalThis.ColorsManager.updateAll(picker.value);
        }

        if (!swatchesWrap.dataset.bound) {
            swatchesWrap.dataset.bound = '1';
            swatchesWrap.addEventListener('click', (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                const button = target.closest('[data-color]');
                if (!(button instanceof HTMLElement)) return;
                const hex = button.getAttribute('data-color') || '';
                if (!/^#[0-9A-F]{6}$/i.test(hex)) return;
                picker.value = hex;
                if (globalThis.ColorsManager?.addToHistory) {
                    globalThis.ColorsManager.addToHistory(hex);
                }
                if (globalThis.ColorsManager?.updateAll) {
                    globalThis.ColorsManager.updateAll(hex);
                }
            });
        }

        if (!picker.dataset.bound) {
            picker.dataset.bound = '1';
            picker.addEventListener('input', () => {
                if (globalThis.ColorsManager?.updateAll) {
                    globalThis.ColorsManager.updateAll(picker.value);
                }
            });
        }

        const eyedropperBtn = document.getElementById('btn-eyedropper');
        if (eyedropperBtn && !eyedropperBtn.dataset.bound) {
            eyedropperBtn.dataset.bound = '1';
            eyedropperBtn.addEventListener('click', async () => {
                const picked = await startColorPicker();
                if (!picked) return;
                const hex = toHex(picked);
                if (!/^#[0-9A-F]{6}$/i.test(hex)) return;
                picker.value = hex;
                if (globalThis.ColorsManager?.addToHistory) {
                    globalThis.ColorsManager.addToHistory(hex);
                }
                if (globalThis.ColorsManager?.updateAll) {
                    globalThis.ColorsManager.updateAll(hex);
                }
            });
        }

        // Bouton "Copier" à côté de la pipette
        const copyPickerBtn = document.getElementById('btn-copy-picker-color');
        if (copyPickerBtn && !copyPickerBtn.dataset.bound) {
            copyPickerBtn.dataset.bound = '1';
            copyPickerBtn.addEventListener('click', async () => {
                const hex = String(picker.value || '').toUpperCase();
                if (!hex) { setStatus('Aucune couleur active.'); return; }
                try {
                    await copyText(hex);
                    setStatus(`✅ Couleur copiée: ${hex}`);
                    const original = copyPickerBtn.textContent;
                    copyPickerBtn.textContent = '✅ Copié';
                    setTimeout(() => { copyPickerBtn.textContent = original; }, 1000);
                } catch (_err) {
                    setStatus('❌ Impossible de copier.');
                }
            });
        }
    };

    const collectTabData = async () => {
        const tabs = await chromeQueryTabs({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (!tab?.id || !tab.url?.startsWith('http')) {
            setStatus('Page non analysable.');
            return null;
        }

        activeTabId = tab.id;
        try { currentHostname = new URL(tab.url).hostname; } catch (_) { currentHostname = ''; }
        if (activeUrlEl) activeUrlEl.textContent = tab.url;
        updateNofollowTopbarButton();
        setStatus('Analyse en cours...');

        const response = await chromeSendMessage(tab.id, { type: 'COLLECT_DATA' });
        if (!response || response.success === false) {
            throw new Error(response?.error || 'Erreur de collecte.');
        }

        return globalThis.PageDataV2?.createPageData
            ? globalThis.PageDataV2.createPageData(response.data)
            : response.data;
    };

    const renderOverview = (data) => {
        if (!overviewEl || !data) return;

        const titleLength = String(data.title || '').length;
        const descLength = String(data.metaDescription || '').length;
        const nofollow = data.linkDetails?.summary?.nofollow || 0;
        const auditScore = lastAuditResult?.score ?? null;
        const scoreValue = auditScore === null ? '...' : String(auditScore);
        const scoreGrade = auditScore === null
            ? 'F'
            : auditScore >= 90 ? 'A'
            : auditScore >= 75 ? 'B'
            : auditScore >= 60 ? 'C'
            : auditScore >= 45 ? 'D'
            : 'F';
        const scoreClass = auditScore === null
            ? 'score-f'
            : auditScore >= 90 ? 'score-a'
            : auditScore >= 75 ? 'score-b'
            : auditScore >= 60 ? 'score-c'
            : auditScore >= 45 ? 'score-d'
            : 'score-f';
        const netIp = esc(lastNetworkInfo?.ip || 'Detection...');
        const netCdn = esc(lastNetworkInfo?.cdn || 'Detection...');
        const keywordList = Array.isArray(data.words) && data.words.length
            ? data.words.slice(0, 6).map((item) => `<span class="meta-badge clickable">${esc(item.word)} <strong>${Number(item.count || 0)}</strong></span>`).join('')
            : '<span class="meta-badge">Aucun mot-clé</span>';

        overviewEl.innerHTML = `
            <div id="nofollow-active-notification" class="nofollow-banner" style="display:none;">
                <div class="nofollow-banner-inner">
                    <span class="nofollow-banner-text">⚡ Surlignage Nofollow Actif</span>
                    <button id="btn-toggle-nofollow-quick" class="nofollow-banner-btn">Désactiver (ici)</button>
                </div>
            </div>

            <div class="card" style="background:#12272b; color:white; border:none; padding:10px; margin-bottom: 15px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap: 12px;">
                    <span style="font-size:12px;">🌐 IP Serveur: <strong id="net-ip" style="color:#abd8d8">${netIp}</strong></span>
                    <span style="font-size:12px;">☁️ CDN: <strong id="net-cdn" style="color:#f1fd0d">${netCdn}</strong></span>
                </div>
            </div>

            <div class="overview-grid">
                <div class="overview-main">
                    <div class="card">
                        <div class="card-header">
                            <span class="label">Titre</span>
                            <span id="title-tag" class="tag tag-warning">${titleLength} car.</span>
                            <button id="copy-title-btn" class="btn btn-icon" data-copy-value="${esc(data.title || '')}" title="Copier le titre">📋</button>
                        </div>
                        <p id="overview-title" class="data-text">${esc(data.title || '-')}</p>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <span class="label">Description</span>
                            <span id="description-tag" class="tag tag-danger">${descLength} car.</span>
                            <button id="copy-desc-btn" class="btn btn-icon" data-copy-value="${esc(data.metaDescription || '')}" title="Copier la description">📋</button>
                        </div>
                        <p id="overview-description" class="data-text">${esc(data.metaDescription || '-')}</p>
                    </div>

                    <div class="card">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <h3 style="margin:0; border:none;">Aperçu Google</h3>
                        </div>
                        <div class="snippet-preview">
                            <span id="snippet-title" class="snippet-title-text">${esc(data.title || '-')}</span>
                            <span id="snippet-url" class="snippet-url-text">${esc(data.url || '-')}</span>
                            <p id="snippet-desc" class="snippet-desc-text">${esc(data.metaDescription || '-')}</p>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header"><span class="label">Robots</span><span id="robots-tag" class="tag tag-ok">${esc(String(data.robots || '').trim() || '...')}</span></div>
                        <p id="overview-robots" class="data-text data-code">${esc(data.robots || 'Chargement...')}</p>
                    </div>

                    <div class="card">
                        <div class="card-header"><span class="label">URL Canonique</span><span id="canonical-tag" class="tag">${data.canonical ? 'OK' : 'Manquant'}</span><button id="copy-canonical-btn" class="btn btn-icon" data-copy-value="${esc(data.canonical || '')}" title="Copier l'URL canonique">📋</button></div>
                        <p id="overview-canonical" class="data-text data-code">${esc(data.canonical || '-')}</p>
                    </div>

                    <div class="card">
                        <div class="card-header"><span class="label">Hreflang</span><span id="hreflang-tag" class="tag">${Array.isArray(data.hreflang) ? data.hreflang.length : 0}</span></div>
                        <div id="overview-hreflang" class="data-list">
                            ${Array.isArray(data.hreflang) && data.hreflang.length
                                ? data.hreflang.map((item) => `<p><span class="data-key">${esc(item.lang || '-')}</span> <span class="data-value">${esc(item.href || '-')}</span></p>`).join('')
                                : '<p>Chargement...</p>'}
                        </div>
                    </div>

                    <div class="card">
                        <h3>Balises & Structure</h3>
                        <div class="meta-badges">
                            <span id="badge-og" class="meta-badge clickable">Open Graph</span>
                            <span id="badge-twitter" class="meta-badge clickable">Twitter Card</span>
                            <span id="badge-viewport" class="meta-badge clickable">Viewport</span>
                            <span id="badge-schema" class="meta-badge clickable">Données Struct.</span>
                        </div>
                        <div class="meta-extras">
                            <div class="meta-extra-item"><span class="label">Keywords:</span><span id="overview-keywords" class="value">${keywordList}</span></div>
                            <div class="meta-extra-item"><span class="label">Publisher:</span><span id="overview-publisher" class="value">${esc(data.publisher || '...')}</span></div>
                        </div>
                    </div>

                    <div id="hn-overview-card" class="card card-clickable">
                        <h3>Structure des Titres (Aperçu)</h3>
                        <div class="headings-structure-summary">
                            <span id="hn-overview-h1" class="hn-tag hn-h1">H1: <strong>${data.headings?.counts?.H1 ?? 0}</strong></span>
                            <span id="hn-overview-h2" class="hn-tag hn-h2">H2: <strong>${data.headings?.counts?.H2 ?? 0}</strong></span>
                            <span id="hn-overview-h3" class="hn-tag hn-h3">H3: <strong>${data.headings?.counts?.H3 ?? 0}</strong></span>
                            <span id="hn-overview-h4" class="hn-tag hn-h4">H4: <strong>${data.headings?.counts?.H4 ?? 0}</strong></span>
                            <span id="hn-overview-h5" class="hn-tag hn-h5">H5: <strong>${data.headings?.counts?.H5 ?? 0}</strong></span>
                            <span id="hn-overview-h6" class="hn-tag hn-h6">H6: <strong>${data.headings?.counts?.H6 ?? 0}</strong></span>
                        </div>
                        <div id="hn-overview-sample" class="hn-sample"></div>
                    </div>
                </div>

                <div class="overview-sidebar">
                    <div class="card">
                        <h3>Score SEO</h3>
                        <div class="score-container">
                            <div id="score-circle-container" class="score-circle ${scoreClass}">
                                <span id="score-number" class="score-number">${scoreValue}</span>
                                <span id="score-grade" class="score-grade">${scoreGrade}</span>
                            </div>
                        </div>
                        <p id="score-issues" class="score-issues" title="">${lastAuditResult ? `OK ${lastAuditResult.stats.ok} • Warn ${lastAuditResult.stats.warning} • Err ${lastAuditResult.stats.error}` : 'Lance l’audit pour calculer le score'}</p>
                    </div>

                    <div class="card">
                        <h3>Stats Page</h3>
                        <div class="stats-grid">
                            <div class="stat-item clickable" id="stat-words-clickable" title="Voir l'analyse des mots">
                                <span id="stats-words" class="stat-value" style="color:var(--color-blue); text-decoration:underline;">${Number(data.wordCount || 0)}</span>
                                <span class="stat-label">mots (cliquer)</span>
                            </div>
                            <div class="stat-item clickable" title="Voir les redirections">
                                <span id="stats-status-code" class="stat-value" style="color:var(--color-blue); text-decoration:underline;">${lastNetworkInfo?.server ? 'Info' : '...'}</span>
                                <span class="stat-label">Réseau</span>
                            </div>
                            <div class="stat-item">
                                <span id="stats-https" class="stat-value ${String(data.url || '').startsWith('https://') ? 'stat-yes' : 'stat-no'}">${String(data.url || '').startsWith('https://') ? 'Oui' : 'Non'}</span>
                                <span class="stat-label">HTTPS</span>
                            </div>
                            <div class="stat-item">
                                <span id="stats-lang" class="stat-value">${esc(data.lang || '...')}</span>
                                <span class="stat-label">Langue</span>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <h3>Technologie & Thème</h3>
                        <div class="tech-sidebar-list">
                            <div class="tech-sidebar-item"><span class="label">CMS:</span><span id="stats-cms" class="value">${esc(data.technologies?.cms?.items?.[0]?.name || '...')}</span></div>
                            <div class="tech-sidebar-item"><span class="label">Thème:</span><span id="stats-theme" class="value clickable" title="Rechercher ce thème">${esc(data.technologies?.theme?.items?.[0]?.name || '...')}</span></div>
                        </div>
                        <div style="margin-top:10px; border-top:1px dashed #eee; padding-top:5px;">
                            <span class="label" style="font-size:12px; color:#666; font-weight:bold; display:block; margin-bottom:5px;">Extensions:</span>
                            <div id="sidebar-plugins-list" style="font-size:12px; color:#333; line-height:1.4;">
                                ${(data.technologies?.plugin?.items || []).slice(0, 4).map((item) => esc(item.name)).join('<br>') || '...'}
                            </div>
                        </div>
                        <div style="margin-top:15px; border-top:1px dashed #eee; padding-top:10px;">
                            <h4 style="margin:0 0 10px 0; font-size:13px; color:var(--color-dark-2);">Top Mots-clés</h4>
                            <div id="sidebar-keywords-list" class="meta-badges">${keywordList}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        overviewEl.querySelectorAll('[data-copy-value]').forEach((button) => {
            button.addEventListener('click', async () => {
                const value = button.getAttribute('data-copy-value') || '';
                try {
                    await copyText(value);
                    setStatus('Texte copié.');
                } catch (_err) {
                    setStatus('Impossible de copier.');
                }
            });
        });

        const nofollowToggle = document.getElementById('nofollow-toggle');
        nofollowToggle?.addEventListener('change', () => {
            setNofollowState(nofollowToggle.checked);
        });

        // Bouton topbar nofollow : toggle pour le site courant
        document.getElementById('btn-nofollow-topbar')?.addEventListener('click', () => {
            toggleCurrentSiteNofollow();
        });

        // Bouton "Désactiver (ici)" dans la bannière aperçu (legacy)
        document.addEventListener('click', (e) => {
            if (e.target?.id === 'btn-toggle-nofollow-quick') {
                toggleCurrentSiteNofollow();
            }
        });

        // Réagir aux changements de storage (ex: toggle global dans Avancé)
        try {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes[NOFOLLOW_STORAGE_KEY]) {
                    updateNofollowTopbarButton();
                }
            });
        } catch (_) {}
    };
    const renderModules = (data) => {
        renderAuditPanel(data);
        renderSpeed(data);
        renderWords(data);
        renderOpportunities(data);
        globalThis.MetadataModuleV2?.render(metadataEl, data);
        globalThis.HeadingsModuleV2?.render(headingsEl, data);
        globalThis.LinksModuleV2?.render(linksEl, data);
        globalThis.ImagesModuleV2?.render(imagesEl, data);
        renderColors(data);
        globalThis.StructuredDataModuleV2?.render(structuredDataEl, data);
        renderTechnical(data);
        renderTechnologies(data);
        renderAdvanced(data);
        globalThis.BrandModuleV2?.render(brandEl, data, {
            onPrintPdf: () => runCaptureExport('pdf')
        });
        globalThis.ResponsiveModuleV2?.render(responsiveEl, data);
        globalThis.FaviconModuleV2?.render(faviconEl, data);
    };

    const renderAuditPanel = (data) => {
        if (!auditEl) return;
        if (lastAuditResult) {
            globalThis.AuditRendererV2?.render(auditEl, lastAuditResult);
            return;
        }

        auditEl.innerHTML = `
            <div class="audit-launch-card">
                <div class="audit-launch-copy">
                    <div class="audit-launch-kicker">Audit SEO</div>
                    <h3>Prêt à lancer l'analyse</h3>
                    <p class="panel-note">Le score et les recommandations seront calculés seulement quand tu cliques sur le bouton.</p>
                </div>
                <button id="btn-run-audit" class="btn btn-primary">Lancer l'analyse</button>
            </div>
            <div class="audit-empty-state">Aucun audit lancé pour l'instant.</div>
        `;
    };

    const runAuditAnalysis = () => {
        if (!lastData) {
            setStatus('Aucune page à auditer.');
            return;
        }

        lastAuditResult = globalThis.AuditControllerV2?.analyze ? globalThis.AuditControllerV2.analyze(lastData) : null;
        if (!lastAuditResult) {
            setStatus('Audit indisponible.');
            return;
        }

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
                <div class="speed-grid" id="speed-results-grid">
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
                    <label for="google-api-key" style="font-weight:bold; display:block; margin-bottom:5px;">Clé API Google :</label>
                    <input type="password" id="google-api-key" placeholder="Collez votre clé API Google ici" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:4px;">
                </div>
                <div id="psi-loading" class="panel-note" style="display:none;">Analyse en cours...</div>
                <div id="psi-results" class="advanced-box">Aucune analyse PSI lancée.</div>
            </div>
        `;
    };

    const measureSpeedNow = async () => {
        try {
            setStatus('Mesure vitesse en cours...');
            const data = await collectTabData();
            if (!data) {
                setStatus('Mesure indisponible sur cette page.');
                return;
            }

            if (lastData && typeof lastData === 'object') {
                lastData = {
                    ...lastData,
                    performanceTiming: data.performanceTiming || lastData.performanceTiming
                };
            } else {
                lastData = data;
            }

            renderSpeed(lastData);
            setStatus('Mesure vitesse mise à jour.');
        } catch (err) {
            setStatus(`Mesure speed échouée: ${err?.message || 'erreur inconnue'}`);
        }
    };

    const renderWords = (data) => {
        if (!wordsEl) return;
        globalThis.WordsModuleV2?.render(wordsEl, data, { setStatus });
    };

    const renderOpportunities = () => {
        if (!opportunitiesEl) return;
        if (!lastAuditResult) {
            opportunitiesEl.innerHTML = '<div class="advanced-box">Lance l’audit pour voir les opportunités SEO.</div>';
            return;
        }

        const opportunities = Array.isArray(lastAuditResult.items) ? lastAuditResult.items.filter((item) => item.status !== 'ok') : [];
        opportunitiesEl.innerHTML = opportunities.length
            ? opportunities.map((opp) => `<div class="opp-item opp-${opp.status === 'error' ? 'critical' : opp.status === 'warning' ? 'warning' : 'info'}"><span class="opp-score">${esc(String(opp.weight || ''))}</span><span class="opp-msg">${esc(opp.message)}</span></div>`).join('')
            : '<div class="opp-item opp-success"><span class="opp-score">:)</span><span class="opp-msg">Aucune opportunité critique détectée. Bon travail !</span></div>';
    };

    const switchToTab = (tabId) => {
        document.querySelector(`.menu-tab[data-tab="${tabId}"]`)?.click();
    };

    const fetchTechnicalInfo = async (pageUrl) => {
        const fallback = {
            robotsExists: false,
            sitemapInRobots: false,
            robotsText: ''
        };

        if (!pageUrl) return fallback;

        let origin = '';
        try {
            origin = new URL(pageUrl).origin;
        } catch (_err) {
            return fallback;
        }

        const robotsUrl = `${origin}/robots.txt`;
        try {
            const response = await fetch(robotsUrl, { cache: 'no-store' });
            if (!response.ok) {
                return fallback;
            }

            const text = await response.text();
            const normalized = String(text || '');
            return {
                robotsExists: true,
                sitemapInRobots: /(^|\n)\s*sitemap\s*:/i.test(normalized),
                robotsText: normalized.trim()
            };
        } catch (_err) {
            return fallback;
        }
    };

    const runTechnicalToolAction = async (tool) => {
        if (!activeTabId) {
            setStatus('Onglet actif introuvable.');
            return;
        }

        if (tool === 'colors') {
            switchToTab('tab-colors');
            return;
        }
        if (tool === 'hn') {
            switchToTab('tab-headings');
            return;
        }
        if (tool === 'scripts') {
            switchToTab('tab-technologies');
            return;
        }
        if (tool === 'headers') {
            switchToTab('tab-network');
            return;
        }

        if (tool === 'disable-css') {
            techToolsState.cssDisabled = !techToolsState.cssDisabled;
            const enabled = techToolsState.cssDisabled;
            await executeScriptInTab(activeTabId, (isEnabled) => {
                const markerId = '__ds_disable_css_style__';
                let marker = document.getElementById(markerId);
                if (isEnabled) {
                    if (!marker) {
                        marker = document.createElement('style');
                        marker.id = markerId;
                        marker.textContent = '* { all: unset !important; display: revert !important; } html, body { all: revert !important; }';
                        document.documentElement.appendChild(marker);
                    }
                    return;
                }
                marker?.remove();
            }, [enabled]);
            setStatus(enabled ? 'CSS désactivé sur la page.' : 'CSS réactivé sur la page.');
            renderTechnical(lastData || {});
            return;
        }

        if (tool === 'highlight-links') {
            techToolsState.linksHighlighted = !techToolsState.linksHighlighted;
            const enabled = techToolsState.linksHighlighted;
            await executeScriptInTab(activeTabId, (isEnabled) => {
                const markerId = '__ds_highlight_links_style__';
                let marker = document.getElementById(markerId);
                if (isEnabled) {
                    if (!marker) {
                        marker = document.createElement('style');
                        marker.id = markerId;
                        marker.textContent = 'a[href]{outline:2px dashed #f1fd0d !important; background:rgba(241,253,13,.16)!important;}';
                        document.documentElement.appendChild(marker);
                    }
                    return;
                }
                marker?.remove();
            }, [enabled]);
            setStatus(enabled ? 'Liens surlignés sur la page.' : 'Surlignage des liens retiré.');
            renderTechnical(lastData || {});
        }
    };

    const renderTechnical = (data) => {
        if (!technicalEl) return;
        const pagespeedUrl = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(data.url || '')}`;
        const gtmetrixUrl = `https://gtmetrix.com/?url=${encodeURIComponent(data.url || '')}`;

        const toolLabel = (name, active = false) => `${active ? '✓ ' : ''}${name}`;

        technicalEl.innerHTML = `
            <div class="tech-dashboard-grid">
                <div class="tech-main-stack">
                    <div class="card tech-tools-card">
                        <h3>Outils Visuels & Techniques</h3>
                        <div class="tech-tools-grid">
                            <button type="button" class="tech-tool-btn" data-tech-tool="disable-css">${toolLabel('Désactiver CSS', techToolsState.cssDisabled)}</button>
                            <button type="button" class="tech-tool-btn" data-tech-tool="highlight-links">${toolLabel('Surligner Liens', techToolsState.linksHighlighted)}</button>
                            <button type="button" class="tech-tool-btn" data-tech-tool="colors">Voir Couleurs</button>
                            <button type="button" class="tech-tool-btn" data-tech-tool="scripts">Voir Scripts</button>
                            <button type="button" class="tech-tool-btn" data-tech-tool="hn">Voir Hn</button>
                            <button type="button" class="tech-tool-btn" data-tech-tool="headers">Voir Headers</button>
                        </div>
                    </div>

                    <div class="card tech-robots-card">
                        <h3>Contenu Robots.txt</h3>
                        <pre id="tech-robots-content" class="tech-robots-content">Chargement...</pre>
                    </div>
                </div>

                <div class="tech-side-stack">
                    <div class="card tech-status-card">
                        <h3>Statut Fichiers</h3>
                        <div class="tech-status-row"><span>Robots.txt:</span><span id="tech-robots-badge" class="tech-status-badge">...</span></div>
                        <div class="tech-status-row"><span>Sitemap dans robots.txt:</span><span id="tech-sitemap-badge" class="tech-status-badge">...</span></div>
                    </div>

                    <div class="card tech-cwv-card">
                        <h3>Core Web Vitals</h3>
                        <a class="tech-cwv-banner" href="${pagespeedUrl}" target="_blank" rel="noopener noreferrer">Aucune donnée CWV disponible.<br>Cliquer pour analyse PageSpeed.</a>
                        <a class="tech-gtmetrix-btn" href="${gtmetrixUrl}" target="_blank" rel="noopener noreferrer">Analyse GTmetrix</a>
                    </div>
                </div>
            </div>
        `;

        Array.from(technicalEl.querySelectorAll('[data-tech-tool]')).forEach((button) => {
            button.addEventListener('click', async () => {
                const tool = button.getAttribute('data-tech-tool');
                if (!tool) return;
                try {
                    await runTechnicalToolAction(tool);
                } catch (err) {
                    setStatus(`Action technique échouée: ${err?.message || 'erreur inconnue'}`);
                }
            });
        });

        fetchTechnicalInfo(data.url).then((info) => {
            const robotsBadge = technicalEl.querySelector('#tech-robots-badge');
            const sitemapBadge = technicalEl.querySelector('#tech-sitemap-badge');
            const robotsContent = technicalEl.querySelector('#tech-robots-content');
            if (!robotsBadge || !sitemapBadge || !robotsContent) return;

            robotsBadge.textContent = info.robotsExists ? '✓ Oui' : '✕ Non';
            robotsBadge.classList.toggle('is-ok', info.robotsExists);
            robotsBadge.classList.toggle('is-no', !info.robotsExists);

            sitemapBadge.textContent = info.sitemapInRobots ? '✓ Oui' : '✕ Non';
            sitemapBadge.classList.toggle('is-ok', info.sitemapInRobots);
            sitemapBadge.classList.toggle('is-no', !info.sitemapInRobots);

            robotsContent.textContent = info.robotsText || 'Aucun contenu robots.txt récupéré.';
        });
    };

    const renderTechnologies = (data) => {
        if (!technologiesEl) return;
        const techs = data.technologies || {};

        const normalizeClassName = (value) => String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        const buildLogoToken = (name, category) => {
            const source = String(name || '').trim();
            if (!source) return '??';
            if (category === 'Scripts') return 'JS';
            const compact = source.replace(/[^a-zA-Z0-9]/g, '');
            if (compact.length <= 3) return compact.toUpperCase();
            return compact.slice(0, 2).toUpperCase();
        };

        const localLogoMap = {
            wordpress: 'assets/tech-logos/wordpress.svg',
            shopify: 'assets/tech-logos/shopify.svg',
            drupal: 'assets/tech-logos/drupal.svg',
            prestashop: 'assets/tech-logos/prestashop.svg',
            elementor: 'assets/tech-logos/elementor.svg',
            rankmath: 'assets/tech-logos/rankmath.svg',
            'rank-math': 'assets/tech-logos/rankmath.svg',
            jquery: 'assets/tech-logos/jquery.svg'
        };

        const slugMap = globalThis.TechLogoAliasesV2 || {};

        const inferLogoSlug = (name) => {
            const key = normalizeClassName(name);
            if (!key) return '';
            if (slugMap[key]) return slugMap[key];

            const aliases = Object.keys(slugMap);
            const byContains = aliases.find((alias) => key.includes(alias));
            if (byContains) return slugMap[byContains];

            const ignoreParts = new Set(['min', 'js', 'css', 'cdn', 'wp', 'includes', 'content', 'themes', 'theme']);
            const parts = key.split('-').filter((part) => part && !ignoreParts.has(part));
            const mappedPart = parts.find((part) => slugMap[part]);
            if (mappedPart) return slugMap[mappedPart];
            return parts[0] || key;
        };

        const buildLogoCandidates = (name) => {
            const key = normalizeClassName(name);
            const localPath = localLogoMap[key] || (key.includes('jquery') ? localLogoMap.jquery : '');
            const candidates = [];

            if (localPath) {
                candidates.push(chrome.runtime.getURL(localPath));
            }

            const slug = inferLogoSlug(name);
            if (slug) {
                candidates.push(`https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${slug}/${slug}-original.svg`);
                candidates.push(`https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${slug}/${slug}-plain.svg`);
                candidates.push(`https://cdn.simpleicons.org/${slug}`);
            }

            return candidates.filter(Boolean);
        };

        const renderGroup = (title, group) => {
            const items = Array.isArray(group?.items) ? group.items : [];
            const list = items.length
                ? items.map((item) => {
                    const rawName = item?.name || '';
                    const version = item?.version ? String(item.version) : '';
                    const token = buildLogoToken(rawName, title);
                    const candidates = buildLogoCandidates(rawName);
                    const firstLogo = candidates[0] || '';
                    const encodedCandidates = candidates.map((url) => encodeURIComponent(url)).join('|');
                    const logoStateClass = firstLogo ? 'has-img' : 'is-missing';
                    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${rawName} ${title}`)}`;
                    return `
                        <div class="tech-item">
                            <span class="tech-logo-box ${logoStateClass}" data-tech-logo-box>
                                <span class="tech-logo-fallback">${esc(token)}</span>
                                ${firstLogo ? `<img class="tech-logo-img" data-tech-logo data-tech-candidates="${encodedCandidates}" data-logo-index="0" src="${esc(firstLogo)}" alt="${esc(rawName)}">` : ''}
                            </span>
                            <span class="tech-item-label">
                                <a class="tech-name-link" href="${searchUrl}" target="_blank" rel="noopener noreferrer">${esc(rawName)}</a>
                                ${version ? `<span class="tech-version">${esc(version)}</span>` : ''}
                            </span>
                        </div>
                    `;
                }).join('')
                : '<div class="hint">Non détecté</div>';
            return `<div class="tech-category tech-category-large"><h4>${title}</h4>${list}</div>`;
        };

        technologiesEl.innerHTML = `
            <div class="tech-grid">
                ${renderGroup('CMS', techs.cms)}
                ${renderGroup('Thème', techs.theme)}
                ${renderGroup('Plugins', techs.plugin)}
                ${renderGroup('Scripts', techs.script)}
            </div>
        `;

        Array.from(technologiesEl.querySelectorAll('img[data-tech-logo]')).forEach((img) => {
            img.addEventListener('load', () => {
                const box = img.closest('[data-tech-logo-box]');
                if (!box) return;
                box.classList.add('has-img');
                box.classList.remove('is-missing');
            });

            img.addEventListener('error', () => {
                const encodedCandidates = String(img.dataset.techCandidates || '');
                const candidates = encodedCandidates
                    .split('|')
                    .map((value) => value && decodeURIComponent(value))
                    .filter(Boolean);
                const currentIndex = Number.parseInt(String(img.dataset.logoIndex || '0'), 10) || 0;
                const nextIndex = currentIndex + 1;

                if (nextIndex < candidates.length) {
                    img.dataset.logoIndex = String(nextIndex);
                    img.src = candidates[nextIndex];
                    return;
                }

                const box = img.closest('[data-tech-logo-box]');
                if (!box) return;
                box.classList.add('is-missing');
                box.classList.remove('has-img');
            });
        });
    };

    const renderAdvanced = (data) => {
    if (!advancedEl) return;
    globalThis.AdvancedModuleV2?.render(advancedEl, data);
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
    };

    const openSaveModal = (item) => {
        document.getElementById('ds-save-modal')?.remove();

        const d = item.data || {};
        const audit = Number(item.score || 0);
        const scoreClass = audit >= 75 ? 'score-a' : audit >= 50 ? 'score-b' : 'score-f';

        const metaRows = [
            ['URL', d.url || item.url || '-'],
            ['Titre', d.title || item.title || '-'],
            ['Description', d.metaDescription || '-'],
            ['Canonical', d.canonical || '-'],
            ['Robots', d.robots || '-'],
            ['Langue', d.lang || '-'],
            ['Viewport', d.viewport || '-'],
            ['H1', d.h1 || '-'],
            ['Mots', String(d.wordCount || item.wordCount || 0)],
            ['Images', String(d.counts?.images || 0)],
            ['Liens', String(d.counts?.links || 0)],
            ['JSON-LD', String(d.jsonLdCount || 0)],
            ['OG Title', d.openGraph?.title || '-'],
            ['Twitter Card', d.twitterCard?.card || '-'],
            ['Sauvegardé le', item.createdLabel || item.createdAt || '-']
        ].map(([k, v]) => `
            <div class="save-modal-row">
                <span class="save-modal-key">${esc(k)}</span>
                <span class="save-modal-val">${esc(v)}</span>
            </div>
        `).join('');

        const modal = document.createElement('div');
        modal.id = 'ds-save-modal';
        modal.innerHTML = `
            <div class="save-modal-backdrop"></div>
            <div class="save-modal-box" role="dialog" aria-modal="true">
                <div class="save-modal-head">
                    <div class="save-modal-head-info">
                        <div class="save-modal-title">${esc(item.title || '(Sans titre)')}</div>
                        <div class="save-modal-url">${esc(item.url || '')}</div>
                    </div>
                    <div class="save-modal-score ${scoreClass}">${audit}</div>
                </div>
                <div class="save-modal-body">
                    <div class="save-modal-section-title">Données SEO</div>
                    <div class="save-modal-table">${metaRows}</div>
                </div>
                <div class="save-modal-footer">
                    <button type="button" class="btn btn-secondary" id="save-modal-export">💾 Exporter JSON</button>
                    <button type="button" class="btn btn-primary" id="save-modal-close">✕ Fermer</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.querySelector('.save-modal-box')?.classList.add('is-open'));

        const close = () => { modal.classList.add('is-closing'); setTimeout(() => modal.remove(), 200); };
        modal.querySelector('.save-modal-backdrop')?.addEventListener('click', close);
        modal.querySelector('#save-modal-close')?.addEventListener('click', close);
        modal.querySelector('#save-modal-export')?.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
            const date = new Date().toISOString().slice(0, 10);
            globalThis.UtilsV2?.downloadBlob(blob, `save-${date}.json`);
        });
        document.addEventListener('keydown', function escClose(e) {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escClose); }
        });
    };

    const refreshSavedList = async () => {
        if (!savedListEl) return;
        const entries = await storageGet(STORAGE_KEY);
        const saves = Array.isArray(entries) ? entries : [];
        if (!saves.length) {
            savedListEl.innerHTML = '<div class="hint">Aucune sauvegarde pour le moment.</div>';
            return;
        }

        savedListEl.innerHTML = saves.map((item, idx) => {
            const audit = Number(item.score || 0);
            const badgeClass = audit >= 75 ? 'ok' : audit >= 50 ? 'warn' : 'err';
            return `
            <div class="save-item save-item-clickable" data-save-index="${idx}" tabindex="0" role="button">
                <div class="save-item-header">
                    <strong>${esc(item.title || '(Sans titre)')}</strong>
                    <span class="save-score-badge save-score-${badgeClass}">${audit}/100</span>
                </div>
                <div class="save-meta">${esc(item.url || '')}</div>
                <div class="save-meta">${esc(item.createdLabel || item.createdAt || '')} • ${Number(item.wordCount || 0)} mots</div>
                <div class="save-hint">Cliquer pour les détails →</div>
            </div>
        `}).join('');

        Array.from(savedListEl.querySelectorAll('.save-item-clickable')).forEach((el) => {
            const open = () => {
                const idx = Number(el.getAttribute('data-save-index'));
                if (saves[idx]) openSaveModal(saves[idx]);
            };
            el.addEventListener('click', open);
            el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(); });
        });
    };

    const saveCurrentAnalysis = async () => {
        if (!lastData) {
            setStatus('Aucune analyse à sauvegarder.');
            return;
        }

        const now = new Date();
        const entry = {
            id: String(now.getTime()),
            createdAt: now.toISOString(),
            createdLabel: now.toLocaleString('fr-FR'),
            url: lastData.url,
            title: lastData.title,
            wordCount: lastData.wordCount,
            score: lastAuditResult?.score || 0,
            data: lastData
        };

        const current = await storageGet(STORAGE_KEY);
        const list = Array.isArray(current) ? current : [];
        list.unshift(entry);
        await storageSet(STORAGE_KEY, list.slice(0, MAX_SAVES));
        await refreshSavedList();
        setStatus('Analyse sauvegardée.');
    };

    const exportSaves = async () => {
        const entries = await storageGet(STORAGE_KEY);
        const list = Array.isArray(entries) ? entries : [];
        if (!list.length) {
            setStatus('Aucune sauvegarde à exporter.');
            return;
        }

        const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
        const date = new Date().toISOString().slice(0, 10);
        globalThis.UtilsV2.downloadBlob(blob, `devsource-sauvegardes-${date}.json`);
        setStatus('Export JSON lancé.');
    };

    const clearSaves = async () => {
        await storageSet(STORAGE_KEY, []);
        await refreshSavedList();
        setStatus('Sauvegardes vidées.');
    };

    const captureFullPage = async (tabId) => {
        const dims = await chromeSendMessage(tabId, { type: 'GET_PAGE_DIMENSIONS' });
        if (!dims || !dims.totalHeight || !dims.viewportHeight || !dims.totalWidth) {
            throw new Error('Dimensions de page indisponibles.');
        }

        const startX = Number(dims.scrollX || 0);
        const startY = Number(dims.scrollY || 0);
        const shots = [];

        for (let y = 0; y < dims.totalHeight; y += dims.viewportHeight) {
            await chromeSendMessage(tabId, { type: 'SET_SCROLL_POSITION', x: 0, y });
            await new Promise((resolve) => setTimeout(resolve, 160));
            const dataUrl = await captureVisible();
            shots.push({ y, dataUrl });
            setStatus(`Capture... ${Math.min(100, Math.round(((y + dims.viewportHeight) / dims.totalHeight) * 100))}%`);
        }

        await chromeSendMessage(tabId, { type: 'SET_SCROLL_POSITION', x: startX, y: startY });

        const first = await loadImage(shots[0].dataUrl);
        const scale = first.width / dims.viewportWidth;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(dims.totalWidth * scale);
        canvas.height = Math.round(dims.totalHeight * scale);
        const ctx = canvas.getContext('2d');

        for (const shot of shots) {
            const img = await loadImage(shot.dataUrl);
            const drawY = Math.round(shot.y * scale);
            ctx.drawImage(img, 0, drawY, canvas.width, Math.round(dims.viewportHeight * scale));
        }

        return canvas.toDataURL('image/png');
    };

    const runCaptureExport = async (mode) => {
        if (!activeTabId) {
            setStatus('Onglet actif introuvable.');
            return;
        }

        try {
            setStatus('Début capture pleine page...');
            const dataUrl = await captureFullPage(activeTabId);
            if (capturePreviewEl && capturePreviewWrapEl) {
                capturePreviewEl.src = dataUrl;
                capturePreviewWrapEl.classList.remove('hidden');
            }

            if (mode === 'png') {
                const date = new Date().toISOString().replace(/[:.]/g, '-');
                chrome.downloads.download({
                    url: dataUrl,
                    filename: `capture-pleine-page-${date}.png`,
                    saveAs: true
                });
                setStatus('Export PNG lancé.');
                return;
            }

            openPrintTabForPdf(dataUrl);
            setStatus('Onglet PDF ouvert.');
        } catch (err) {
            setStatus(`Capture échouée: ${err?.message || 'Erreur inconnue'}`);
        }
    };

    const parseBulkEntryToUrl = (line) => {
        const value = String(line || '').trim();
        if (!value) return '';

        if (/^https?:\/\//i.test(value)) {
            return value;
        }

        if (/\s/.test(value)) {
            return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
        }

        if (/^[\w.-]+\.[a-z]{2,}$/i.test(value)) {
            return `https://${value}`;
        }

        return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
    };

    const getBulkUrlsFromInput = () => {
        const inputEl = document.getElementById('bulk-opener-input');
        const raw = String(inputEl?.value || '');
        const lines = raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        const urls = lines.map((line) => parseBulkEntryToUrl(line)).filter(Boolean);
        return globalThis.UtilsV2?.unique ? globalThis.UtilsV2.unique(urls) : Array.from(new Set(urls));
    };

    const updateBulkCount = () => {
        const countEl = document.getElementById('bulk-url-count');
        if (!countEl) return;
        const count = getBulkUrlsFromInput().length;
        countEl.textContent = `${count} URL(s)`;
    };

    const openBulkUrls = async () => {
        const urls = getBulkUrlsFromInput();
        if (!urls.length) {
            setStatus('Aucune URL à ouvrir.');
            return;
        }

        const safeUrls = urls.slice(0, 50);
        for (const url of safeUrls) {
            try {
                chrome.tabs.create({ url });
            } catch (_err) {
                // Ignore single-tab open failures.
            }
        }
        setStatus(`${safeUrls.length} onglet(s) ouvert(s).`);
    };

    const bindTabs = () => {
        const tabs = Array.from(document.querySelectorAll('.menu-tab'));
        const panels = Array.from(document.querySelectorAll('.tab-panel'));

        const activateTab = (target) => {
            tabs.forEach((tab) => tab.classList.toggle('active', tab.getAttribute('data-tab') === target));
            panels.forEach((panel) => panel.classList.toggle('active', panel.id === target));
            settings.activeTab = target;
            saveSettings();
        };

        tabs.forEach((tab) => {
            tab.addEventListener('click', () => activateTab(tab.getAttribute('data-tab')));
        });

        const exists = panels.some((panel) => panel.id === settings.activeTab);
        activateTab(exists ? settings.activeTab : DEFAULT_SETTINGS.activeTab);
    };

    const bindActions = () => {
        document.getElementById('btn-save-analysis')?.addEventListener('click', saveCurrentAnalysis);
        document.getElementById('btn-refresh')?.addEventListener('click', async () => {
            await loadCurrentPage();
        });
        document.getElementById('btn-run-audit')?.addEventListener('click', runAuditAnalysis);
        document.getElementById('btn-export-saves')?.addEventListener('click', exportSaves);
        document.getElementById('btn-clear-saves')?.addEventListener('click', clearSaves);
        document.getElementById('btn-capture-png')?.addEventListener('click', () => runCaptureExport('png'));
        document.getElementById('btn-capture-pdf')?.addEventListener('click', () => runCaptureExport('pdf'));
        document.getElementById('btn-bulk-open-all')?.addEventListener('click', openBulkUrls);
        document.getElementById('btn-bulk-clear')?.addEventListener('click', () => {
            const inputEl = document.getElementById('bulk-opener-input');
            if (inputEl) inputEl.value = '';
            updateBulkCount();
            setStatus('Liste bulk vidée.');
        });
        document.getElementById('bulk-opener-input')?.addEventListener('input', updateBulkCount);
        document.getElementById('bulk-open-meet')?.addEventListener('click', () => chrome.tabs.create({ url: 'https://meet.google.com' }));
        document.getElementById('bulk-open-sheet')?.addEventListener('click', () => chrome.tabs.create({ url: 'https://sheets.new' }));
        document.getElementById('bulk-open-doc')?.addEventListener('click', () => chrome.tabs.create({ url: 'https://docs.new' }));
        updateBulkCount();

        themeToggleEl?.addEventListener('change', async () => {
            settings.theme = themeToggleEl.checked ? 'dark' : 'light';
            applyTheme(settings.theme);
            await saveSettings();
            setStatus('Préférence enregistrée.');
        });

        document.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const speedButton = target.closest('#btn-check-speed');
            if (target.id === 'btn-run-audit') {
                runAuditAnalysis();
                return;
            }
            if (speedButton) {
                measureSpeedNow();
            }
        });
    };

    const loadCurrentPage = async () => {
        try {
            const data = await collectTabData();
            if (!data) return;
            lastData = data;
            lastAuditResult = null;
            renderOverview(data);
            renderModules(data);
            if (window.WordToolsManager){
                window.WordToolsManager.renderTopWords(data);
                if (data.textContent) {
                    window.WordToolsManager.analyzeGlobal(data.textContent);
                }
            }
            await renderNetwork();
            renderOverview(lastData);
            setStatus('Analyse terminée.');
        } catch (err) {
            setStatus(`Erreur: ${err?.message || 'inconnue'}`);
        }
    };

    const init = async () => {
        if (!globalThis.chrome?.tabs || !globalThis.chrome?.storage) {
            setStatus('Environnement extension non supporté.');
            return;
        }

        // Écouter le toggle nofollow déclenché depuis l'onglet Avancé (CustomEvent)
        window.addEventListener('ds:nofollowChanged', (e) => {
            const enabled = Boolean(e.detail?.enabled);
            setNofollowState(enabled);
            // Ne pas envoyer au content script pendant le chargement initial
            if (!isInitializing && activeTabId) {
                chromeSendMessage(activeTabId, { type: 'SET_NOFOLLOW_HIGHLIGHT', enabled }).catch(() => {});
            }
            setStatus(enabled ? 'Surlignage nofollow activé.' : 'Surlignage nofollow désactivé.');
        });

        isInitializing = true;
        await loadSettings();
        isInitializing = false;
        applyTheme(settings.theme);
        bindTabs();
        bindActions();
        globalThis.LinkingControllerV2?.init({ setStatus });
        await refreshSavedList();
        await loadCurrentPage();
    };

    init();
})();