(() => {
    // ─── Constantes ──────────────────────────────────────────────────────────────
    const EXTERNAL_TOOLS = [
        { label: 'Ahrefs',            icon: 'A',  build: (url) => `https://ahrefs.com/site-explorer/overview/v2/subdomains/live?target=${encodeURIComponent(url)}` },
        { label: 'Archive.org',       icon: '🏛', build: (url) => `https://web.archive.org/web/*/${encodeURIComponent(url)}` },
        { label: 'Majestic',          icon: '⭐', build: (url) => `https://majestic.com/reports/site-explorer?folder=&IndexDataSource=F&oq=${encodeURIComponent(url)}` },
        { label: 'Moz',               icon: 'M',  build: (url) => `https://moz.com/domain-analysis?site=${encodeURIComponent(url)}` },
        { label: 'PageSpeed Insights',icon: '<>', build: (url) => `https://pagespeed.web.dev/report?url=${encodeURIComponent(url)}` },
        { label: 'Semrush',           icon: 'S',  build: (url) => `https://www.semrush.com/analytics/overview/?q=${encodeURIComponent(url)}&searchType=domain` },
        { label: 'SimilarWeb',        icon: '📊', build: (url) => `https://www.similarweb.com/website/${encodeURIComponent(url)}/` },
        { label: 'Rich Data Testing', icon: '<>', build: (url) => `https://search.google.com/test/rich-results?url=${encodeURIComponent(url)}` },
        { label: 'Whois',             icon: '👤', build: (url) => `https://who.is/whois/${encodeURIComponent(url)}` },
        { label: 'Google Cache',      icon: 'G',  build: (url) => `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}` },
    ];

    const WINDOW_WIDTHS = [700, 750, 800, 900, 1000, 1100, 1200];
    const USER_AGENTS = [
        { label: 'Défaut',      value: '' },
        { label: 'Googlebot',   value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
        { label: 'Bingbot',     value: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' },
        { label: 'Mobile',      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
    ];

    const STORAGE_KEY = 'v2.advanced.settings';

    // ─── State ────────────────────────────────────────────────────────────────────
    let state = {
        windowWidth: 700,
        userAgent: '',
        darkMode: false,
        googleNumbers: true,
        highlightNofollow: true,
        nofollowExclusions: [],
        faqData: []
    };

    // ─── Helpers ─────────────────────────────────────────────────────────────────
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const getDomain = (url) => {
        try { return new URL(url).hostname; } catch (_) { return url || ''; }
    };

    const saveState = () => {
        try {
            chrome.storage.local.set({ [STORAGE_KEY]: state });
        } catch (_) { /* hors contexte extension */ }
    };

    const loadState = () => new Promise((resolve) => {
    try {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            if (result?.[STORAGE_KEY] && typeof result[STORAGE_KEY] === 'object') {
                state = { ...state, ...result[STORAGE_KEY] };
            }
            // Si la valeur n'a jamais été définie, l'activer par défaut
            if (typeof state.highlightNofollow !== 'boolean') state.highlightNofollow = true;
            resolve();
        });
    } catch (_) { resolve(); }
});

    // ─── Appliquer la largeur de fenêtre ─────────────────────────────────────────
    const applyWindowWidth = (width) => {
        const body = document.body;
        WINDOW_WIDTHS.forEach((w) => body.classList.remove(`window-width-${w}`));
        body.classList.add(`window-width-${width}`);
        body.style.width = `${width}px`;
        state.windowWidth = width;
        saveState();
    };

    // ─── Appliquer le user agent ──────────────────────────────────────────────────
    const applyUserAgent = (ua) => {
        state.userAgent = ua;
        saveState();
        // Note : le vrai UA switching nécessite une extension background page.
        // Ici on sauvegarde la préférence pour que background.js puisse l'appliquer.
        try {
            chrome.runtime.sendMessage({ type: 'SET_USER_AGENT', userAgent: ua });
        } catch (_) { /* ignore */ }
    };

    // ─── Injecter les styles ──────────────────────────────────────────────────────
    const injectStyles = () => {
        if (document.getElementById('advanced-v2-styles')) return;
        const style = document.createElement('style');
        style.id = 'advanced-v2-styles';
        style.textContent = `
            /* ── Layout principal ── */
            .adv-layout {
                display: grid;
                grid-template-columns: 1fr 220px;
                gap: 18px;
                align-items: start;
            }

            /* ── Sections ── */
            .adv-section {
                margin-bottom: 22px;
            }

            .adv-section-title {
                font-size: 15px;
                font-weight: 800;
                color: var(--color-dark-1, #12272b);
                letter-spacing: .01em;
                margin: 0 0 4px;
                padding-bottom: 6px;
                border-bottom: 2px solid var(--color-light-blue, #abd8d8);
            }

            .adv-section-desc {
                font-size: 12px;
                color: #6c7a7d;
                margin: 0 0 12px;
            }

            /* ── Grille outils externes (2 colonnes) ── */
            .adv-tools-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
            }

            .adv-tool-btn {
                display: flex;
                align-items: center;
                gap: 9px;
                padding: 10px 13px;
                background: #fff;
                border: 1px solid #dde4e6;
                border-radius: 10px;
                font-size: 13px;
                font-weight: 600;
                color: var(--color-dark-1, #12272b);
                cursor: pointer;
                text-align: left;
                transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
                text-decoration: none;
            }

            .adv-tool-btn:hover {
                border-color: var(--color-light-blue, #abd8d8);
                box-shadow: 0 3px 10px rgba(18, 39, 43, 0.09);
                background: #f7fbfc;
            }

            .adv-tool-icon {
                width: 28px;
                height: 28px;
                border-radius: 7px;
                background: #f0f4f5;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                font-weight: 900;
                color: #2a3c40;
                flex-shrink: 0;
            }

            /* ── Outils intégrés ── */
            .adv-integrated-link {
                display: block;
                padding: 10px 13px;
                background: #fff;
                border: 1px solid #dde4e6;
                border-radius: 10px;
                font-size: 13px;
                color: #2a7ef0;
                cursor: pointer;
                text-decoration: none;
                font-weight: 600;
                margin-bottom: 8px;
                transition: border-color 0.15s, background 0.15s;
            }

            .adv-integrated-link:hover {
                border-color: #2a7ef0;
                background: #f5f9ff;
            }

            /* ── Toggles ── */
            .adv-toggle-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #edf0f2;
                font-size: 13px;
                font-weight: 600;
                color: #2d3a3e;
            }

            .adv-toggle-row:last-child { border-bottom: none; }

            .adv-switch {
                position: relative;
                width: 44px;
                height: 24px;
                flex-shrink: 0;
            }

            .adv-switch input {
                opacity: 0;
                width: 0;
                height: 0;
                position: absolute;
            }

            .adv-switch-track {
                position: absolute;
                inset: 0;
                background: #d0d8db;
                border-radius: 999px;
                transition: background 0.18s;
                cursor: pointer;
            }

            .adv-switch-track::after {
                content: '';
                position: absolute;
                left: 3px;
                top: 3px;
                width: 18px;
                height: 18px;
                background: #fff;
                border-radius: 50%;
                transition: transform 0.18s;
                box-shadow: 0 1px 3px rgba(0,0,0,.2);
            }

            .adv-switch input:checked + .adv-switch-track {
                background: var(--color-dark-1, #12272b);
            }

            .adv-switch input:checked + .adv-switch-track::after {
                transform: translateX(20px);
            }

            /* ── Sidebar droite ── */
            .adv-sidebar {max-width: 180px;}

            .adv-sidebar-card {
                background: #fff;
                border: 1px solid #dde4e6;
                border-radius: 12px;
                padding: 14px;
                margin-bottom: 14px;
            }

            .adv-sidebar-label {
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: .06em;
                color: #6c7a7d;
                margin: 0 0 8px;
            }

            .adv-sidebar-select {
                width: 100%;
                padding: 8px 10px;
                border: 1px solid #cdd5d8;
                border-radius: 8px;
                font-size: 13px;
                color: #1b2c31;
                background: #f8fafa;
                appearance: auto;
                cursor: pointer;
            }

            .adv-sidebar-hint {
                font-size: 11px;
                color: #8a9599;
                margin: 6px 0 0;
            }

            /* ── Encart "Le saviez-vous ?" ── */
            .adv-tip-card {
                background: #f4f3ff;
                border: 1px solid #d3d0ff;
                border-radius: 12px;
                padding: 14px;
            }

            .adv-tip-title {
                font-size: 12px;
                font-weight: 800;
                color: #5a4bcc;
                margin: 0 0 6px;
                text-transform: uppercase;
                letter-spacing: .04em;
            }

            .adv-tip-text {
                font-size: 12px;
                color: #3d3270;
                line-height: 1.55;
                margin: 0;
            }

            .adv-tip-text strong { color: #5a4bcc; }

            /* ── Zone sites exclus ── */
            .adv-exclusions-box {
                background: #f8fafb;
                border: 1px solid #dde4e6;
                border-radius: 9px;
                padding: 10px 12px;
                min-height: 52px;
                font-size: 12px;
                color: #8a9599;
                margin-bottom: 8px;
            }

            .adv-exclusion-tag {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                background: #e6edf0;
                border-radius: 6px;
                padding: 3px 8px;
                font-size: 12px;
                color: #2d3a3e;
                margin: 2px;
            }

            .adv-exclusion-tag button {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 13px;
                color: #6c7a7d;
                padding: 0;
                line-height: 1;
            }

            /* ── Scraper FAQ ── */
            .adv-faq-box {
                background: #f8fafb;
                border: 1px solid #dde4e6;
                border-radius: 9px;
                padding: 10px 12px;
                min-height: 52px;
                font-size: 12px;
                color: #8a9599;
                margin-bottom: 10px;
                max-height: 200px;
                overflow-y: auto;
            }

            .adv-faq-item {
                margin-bottom: 8px;
                padding-bottom: 8px;
                border-bottom: 1px solid #edf0f2;
            }

            .adv-faq-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }

            .adv-faq-q {
                font-weight: 700;
                color: #1b2c31;
                font-size: 12px;
                margin-bottom: 3px;
            }

            .adv-faq-a {
                font-size: 12px;
                color: #4a5a60;
            }

            .adv-faq-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            /* ── Dark mode ── */
            body.theme-dark .adv-section-title {
                color: var(--dark-h3, #abd8d8);
                border-color: #3f6074;
            }

            body.theme-dark .adv-tool-btn,
            body.theme-dark .adv-integrated-link,
            body.theme-dark .adv-sidebar-card {
                background: var(--dark-card, #25303f);
                border-color: var(--dark-border, #3a485a);
                color: var(--dark-text, #e1e3e8);
            }

            body.theme-dark .adv-tool-btn:hover,
            body.theme-dark .adv-integrated-link:hover {
                background: #2e3d4e;
                border-color: #6a8fa4;
            }

            body.theme-dark .adv-tool-icon {
                background: #1e2d3a;
                color: #d3e5ee;
            }

            body.theme-dark .adv-integrated-link {
                color: #7cb8f5;
            }

            body.theme-dark .adv-toggle-row {
                color: #d3dee6;
                border-color: #3a4d60;
            }

            body.theme-dark .adv-switch-track {
                background: #4a5a70;
            }

            body.theme-dark .adv-section-desc {
                color: #8fa8b8;
            }

            body.theme-dark .adv-sidebar-select {
                background: #1e2c38;
                border-color: #3f5266;
                color: #d4e0ea;
            }

            body.theme-dark .adv-sidebar-label,
            body.theme-dark .adv-sidebar-hint {
                color: #7a9aac;
            }

            body.theme-dark .adv-exclusions-box,
            body.theme-dark .adv-faq-box {
                background: #1c2a36;
                border-color: #3a4e60;
                color: #7a9aac;
            }

            body.theme-dark .adv-exclusion-tag {
                background: #2a3d50;
                color: #c8d8e4;
            }

            body.theme-dark .adv-tip-card {
                background: #1e1a3a;
                border-color: #4a3f9a;
            }

            body.theme-dark .adv-tip-title { color: #9d8eff; }
            body.theme-dark .adv-tip-text { color: #b8aef5; }
            body.theme-dark .adv-tip-text strong { color: #9d8eff; }

            body.theme-dark .adv-faq-q { color: #d4e0ea; }
            body.theme-dark .adv-faq-a { color: #9ab4c4; }
            body.theme-dark .adv-faq-item { border-color: #3a4e60; }
        `;
        document.head.appendChild(style);
    };

    // ─── Render outils externes ───────────────────────────────────────────────────
    const renderExternalTools = (url) => {
        return EXTERNAL_TOOLS.map((tool) => {
            const href = url ? tool.build(url) : '#';
            return `
                <a class="adv-tool-btn" href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="${esc(tool.label)}">
                    <span class="adv-tool-icon">${tool.icon}</span>
                    ${esc(tool.label)}
                </a>
            `;
        }).join('');
    };

    // ─── Render exclusions nofollow ───────────────────────────────────────────────
    const renderExclusions = (container) => {
        const box = container.querySelector('#adv-exclusions-box');
        if (!box) return;
        if (!state.nofollowExclusions.length) {
            box.innerHTML = '<span>Aucun site exclu.</span>';
            return;
        }
        box.innerHTML = state.nofollowExclusions.map((site, i) => `
            <span class="adv-exclusion-tag">
                ${esc(site)}
                <button data-excl-remove="${i}" title="Supprimer">×</button>
            </span>
        `).join('');
    };

    // ─── Render FAQ ───────────────────────────────────────────────────────────────
    const renderFaq = (container, faqItems) => {
        const box = container.querySelector('#adv-faq-box');
        if (!box) return;

        if (!faqItems || !faqItems.length) {
            box.innerHTML = 'Aucune FAQ (JSON-LD ou HTML simple) détectée.';
            return;
        }

        box.innerHTML = faqItems.map((item) => `
            <div class="adv-faq-item">
                <div class="adv-faq-q">${esc(item.question || item.name || '')}</div>
                <div class="adv-faq-a">${esc(item.answer || item.acceptedAnswer?.text || '')}</div>
            </div>
        `).join('');
    };

    // ─── Extraire FAQ depuis les données structurées ──────────────────────────────
    const extractFaq = (data) => {
        if (!Array.isArray(data?.structuredData)) return [];
        const faqs = [];
        data.structuredData.forEach((schema) => {
            if (!schema || schema.error) return;
            const type = Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'];
            if (type === 'FAQPage' && Array.isArray(schema.mainEntity)) {
                schema.mainEntity.forEach((item) => faqs.push(item));
            }
        });
        return faqs;
    };

    // ─── Render principal ─────────────────────────────────────────────────────────
    const render = async (container, data = {}) => {
        if (!container) return;
        injectStyles();

        await loadState();

        const currentUrl = String(data?.url || '').trim();
        const domain = getDomain(currentUrl);
        const faqItems = extractFaq(data);
        state.faqData = faqItems;

        container.innerHTML = `
            <div class="adv-layout">

                <!-- Colonne principale -->
                <div class="adv-main">

                    <!-- Outils d'analyse externe -->
                    <div class="adv-section">
                        <h3 class="adv-section-title">Outils d'Analyse Externe</h3>
                        <p class="adv-section-desc">Ces liens vous amèneront au service correspondant pour le site web actuel.</p>
                        <div class="adv-tools-grid">
                            ${renderExternalTools(currentUrl)}
                        </div>
                    </div>

                    <!-- Outils intégrés -->
                    <div class="adv-section">
                        <h3 class="adv-section-title">Outils Intégrés</h3>

                        <a class="adv-integrated-link" id="adv-link-inurl" href="#">
                            Lancer une recherche -inurl:https
                        </a>
                        <a class="adv-integrated-link" id="adv-link-site" href="#">
                            Lancer une recherche site:${esc(domain || 'domaine.com')}
                        </a>

                        <div class="adv-toggle-row">
                            <span>Numérotation Google</span>
                            <label class="adv-switch">
                                <input type="checkbox" id="adv-toggle-numbers" ${state.googleNumbers ? 'checked' : ''}>
                                <span class="adv-switch-track"></span>
                            </label>
                        </div>

                        <div class="adv-toggle-row">
                            <span>Surligner les liens Nofollow</span>
                            <label class="adv-switch">
                                <input type="checkbox" id="adv-toggle-nofollow" ${state.highlightNofollow ? 'checked' : ''}>
                                <span class="adv-switch-track"></span>
                            </label>
                        </div>
                    </div>

                    <!-- Sites exclus du Nofollow -->
                    <div class="adv-section">
                        <h3 class="adv-section-title">Sites exclus du Nofollow</h3>
                        <div class="adv-exclusions-box" id="adv-exclusions-box">
                            <span>Aucun site exclu.</span>
                        </div>
                        <button type="button" class="btn btn-secondary" id="adv-btn-clear-exclusions">Tout supprimer</button>
                    </div>

                    <!-- Scraper FAQ -->
                    <div class="adv-section">
                        <h3 class="adv-section-title">Scraper FAQ (JSON-LD)</h3>
                        <div class="adv-faq-box" id="adv-faq-box">
                            Aucune FAQ (JSON-LD ou HTML simple) détectée.
                        </div>
                        <div class="adv-faq-actions">
                            <button type="button" class="btn btn-secondary" id="adv-faq-copy">📋 Copier</button>
                            <button type="button" class="btn btn-secondary" id="adv-faq-excel">📊 Excel</button>
                            <button type="button" class="btn btn-primary"   id="adv-faq-pdf">📄 PDF</button>
                        </div>
                    </div>

                </div>

                <!-- Sidebar droite -->
                <div class="adv-sidebar">

                    <!-- Largeur de fenêtre -->
                    <div class="adv-sidebar-card">
                        <p class="adv-sidebar-label">Largeur de la fenêtre</p>
                        <select class="adv-sidebar-select" id="adv-select-width">
                            ${WINDOW_WIDTHS.map((w) => `<option value="${w}" ${state.windowWidth === w ? 'selected' : ''}>${w}px</option>`).join('')}
                        </select>
                        <p class="adv-sidebar-hint">La largeur est sauvegardée automatiquement.</p>
                    </div>

                    <!-- Changer le User Agent -->
                    <div class="adv-sidebar-card">
                        <p class="adv-sidebar-label">Changer l'User Agent</p>
                        <select class="adv-sidebar-select" id="adv-select-ua">
                            ${USER_AGENTS.map((ua) => `<option value="${esc(ua.value)}" ${state.userAgent === ua.value ? 'selected' : ''}>${esc(ua.label)}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Mode Sombre (miroir du toggle principal) -->
                    <div class="adv-sidebar-card">
                        <div class="adv-toggle-row" style="padding:0; border:none;">
                            <span style="font-size:13px; font-weight:600;">Mode Sombre</span>
                            <label class="adv-switch">
                                <input type="checkbox" id="adv-toggle-dark" ${state.darkMode ? 'checked' : ''}>
                                <span class="adv-switch-track"></span>
                            </label>
                        </div>
                    </div>

                    <!-- Le saviez-vous ? -->
                    <div class="adv-tip-card">
                        <p class="adv-tip-title">Le saviez-vous ?</p>
                        <p class="adv-tip-text">N'importe où sur le web, un <strong>Clic Droit</strong> affichera un menu personnalisé pour cette extension.</p>
                    </div>

                </div>
            </div>
        `;

        // Initialiser les affichages dynamiques
        renderExclusions(container);
        renderFaq(container, faqItems);

        // ── Liens -inurl / site: ──────────────────────────────────────────────────
        const inurlLink = container.querySelector('#adv-link-inurl');
        const siteLink = container.querySelector('#adv-link-site');

        if (inurlLink) {
            const inurlHref = domain
                ? `https://www.google.com/search?q=-inurl:https+site:${encodeURIComponent(domain)}`
                : '#';
            inurlLink.href = inurlHref;
            inurlLink.addEventListener('click', (e) => {
                if (!domain) { e.preventDefault(); return; }
                if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
                    e.preventDefault();
                    chrome.tabs.create({ url: inurlHref });
                }
            });
        }

        if (siteLink) {
            const siteHref = domain
                ? `https://www.google.com/search?q=site:${encodeURIComponent(domain)}`
                : '#';
            siteLink.href = siteHref;
            siteLink.textContent = `Lancer une recherche site:${domain || 'domaine.com'}`;
            siteLink.addEventListener('click', (e) => {
                if (!domain) { e.preventDefault(); return; }
                if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
                    e.preventDefault();
                    chrome.tabs.create({ url: siteHref });
                }
            });
        }

        // ── Outils externes → ouvrir dans un nouvel onglet ────────────────────────
        container.querySelectorAll('.adv-tool-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                if (!currentUrl) { e.preventDefault(); return; }
                if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
                    e.preventDefault();
                    chrome.tabs.create({ url: btn.href });
                }
            });
        });

        // ── Largeur de fenêtre ────────────────────────────────────────────────────
        container.querySelector('#adv-select-width')?.addEventListener('change', (e) => {
            const width = Number(e.target.value);
            if (WINDOW_WIDTHS.includes(width)) applyWindowWidth(width);
        });

        // Appliquer la largeur sauvegardée au chargement
        applyWindowWidth(state.windowWidth);

        // ── User Agent ────────────────────────────────────────────────────────────
        container.querySelector('#adv-select-ua')?.addEventListener('change', (e) => {
            applyUserAgent(e.target.value);
        });

        // ── Toggle numérotation Google ────────────────────────────────────────────
        container.querySelector('#adv-toggle-numbers')?.addEventListener('change', (e) => {
            state.googleNumbers = e.target.checked;
            saveState();
            try {
                chrome.runtime.sendMessage({ type: 'SET_GOOGLE_NUMBERS', enabled: state.googleNumbers });
            } catch (_) {}
        });

        // ── Toggle nofollow ───────────────────────────────────────────────────────
        container.querySelector('#adv-toggle-nofollow')?.addEventListener('change', (e) => {
        state.highlightNofollow = e.target.checked;
        saveState();
        const mainToggle = document.getElementById('toggle-highlight-nofollow');
        if (mainToggle) mainToggle.checked = e.target.checked;
        try {
            chrome.runtime.sendMessage({ type: 'HIGHLIGHT_NOFOLLOW', enabled: state.highlightNofollow });
        } catch (_) {}
        window.dispatchEvent(new CustomEvent('ds:nofollowChanged', { detail: { enabled: state.highlightNofollow } }));
    });

        // ── Toggle dark mode (miroir du toggle principal) ─────────────────────────
        const advDarkToggle = container.querySelector('#adv-toggle-dark');
        const mainThemeToggle = document.getElementById('theme-toggle-input');

        // Synchroniser l'état initial avec le toggle principal
        if (mainThemeToggle && advDarkToggle) {
            advDarkToggle.checked = mainThemeToggle.checked;
        }

        advDarkToggle?.addEventListener('change', (e) => {
            state.darkMode = e.target.checked;
            saveState();
            // Déclencher le toggle principal pour cohérence
            if (mainThemeToggle) {
                mainThemeToggle.checked = e.target.checked;
                mainThemeToggle.dispatchEvent(new Event('change'));
            }
        });

        // ── Exclusions nofollow ───────────────────────────────────────────────────
        container.querySelector('#adv-btn-clear-exclusions')?.addEventListener('click', () => {
            state.nofollowExclusions = [];
            saveState();
            renderExclusions(container);
        });

        container.querySelector('#adv-exclusions-box')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-excl-remove]');
            if (!btn) return;
            const idx = Number(btn.getAttribute('data-excl-remove'));
            state.nofollowExclusions.splice(idx, 1);
            saveState();
            renderExclusions(container);
        });

        // ── FAQ : Copier ──────────────────────────────────────────────────────────
        container.querySelector('#adv-faq-copy')?.addEventListener('click', async () => {
            if (!faqItems.length) return;
            const text = faqItems.map((item) => {
                const q = item.question || item.name || '';
                const a = item.answer || item.acceptedAnswer?.text || '';
                return `Q: ${q}\nR: ${a}`;
            }).join('\n\n');
            try {
                await navigator.clipboard.writeText(text);
            } catch (_) {}
        });

        // ── FAQ : Excel ───────────────────────────────────────────────────────────
        container.querySelector('#adv-faq-excel')?.addEventListener('click', () => {
            if (!faqItems.length) return;
            const rows = [['Question', 'Réponse'], ...faqItems.map((item) => [
                item.question || item.name || '',
                item.answer || item.acceptedAnswer?.text || ''
            ])];
            const html = `<table>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
            const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'faq.xls';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 500);
        });

        // ── FAQ : PDF ─────────────────────────────────────────────────────────────
        container.querySelector('#adv-faq-pdf')?.addEventListener('click', () => {
            if (!faqItems.length) return;
            const win = window.open('', '_blank');
            if (!win) return;
            const rows = faqItems.map((item) => `
                <tr>
                    <td style="padding:8px;border:1px solid #ccc;">${item.question || item.name || ''}</td>
                    <td style="padding:8px;border:1px solid #ccc;">${item.answer || item.acceptedAnswer?.text || ''}</td>
                </tr>
            `).join('');
            win.document.write(`<html><head><title>FAQ</title></head><body>
                <h2>FAQ Scraper</h2>
                <table border="1" cellspacing="0" style="border-collapse:collapse;width:100%;">
                    <thead><tr><th>Question</th><th>Réponse</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
                <script>window.onload=()=>setTimeout(()=>window.print(),200);<\/script>
            </body></html>`);
            win.document.close();
        });
    };

    // ─── Export global ────────────────────────────────────────────────────────────
    globalThis.AdvancedModuleV2 = Object.freeze({ render });
})();