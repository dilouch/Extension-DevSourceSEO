(() => {
    let ctx = null;

    const esc = (v) => globalThis.UtilsV2?.escapeHtml ? globalThis.UtilsV2.escapeHtml(v) : String(v ?? '');

    const fetchTechnicalInfo = async (pageUrl) => {
        const fallback = { robotsExists: false, sitemapInRobots: false, robotsText: '' };
        if (!pageUrl) return fallback;
        let origin = '';
        try { origin = new URL(pageUrl).origin; } catch (_) { return fallback; }
        try {
            const response = await fetch(`${origin}/robots.txt`, { cache: 'no-store' });
            if (!response.ok) return fallback;
            const text = await response.text();
            const normalized = String(text || '');
            return {
                robotsExists: true,
                sitemapInRobots: /(^|\n)\s*sitemap\s*:/i.test(normalized),
                robotsText: normalized.trim()
            };
        } catch (_) { return fallback; }
    };

    const runToolAction = async (tool) => {
        const tabId = ctx.getActiveTabId();
        if (!tabId) { ctx.setStatus('Onglet actif introuvable.'); return; }

        if (tool === 'colors') { ctx.switchToTab('tab-colors'); return; }
        if (tool === 'hn') { ctx.switchToTab('tab-headings'); return; }
        if (tool === 'scripts') { ctx.switchToTab('tab-technologies'); return; }
        if (tool === 'headers') { ctx.switchToTab('tab-network'); return; }

        if (tool === 'disable-css') {
            ctx.techToolsState.cssDisabled = !ctx.techToolsState.cssDisabled;
            const enabled = ctx.techToolsState.cssDisabled;
            await ctx.executeScript(tabId, (isEnabled) => {
                const id = '__ds_disable_css_style__';
                let el = document.getElementById(id);
                if (isEnabled) {
                    if (!el) {
                        el = document.createElement('style'); el.id = id;
                        el.textContent = '* { all: unset !important; display: revert !important; } html, body { all: revert !important; }';
                        document.documentElement.appendChild(el);
                    }
                    return;
                }
                el?.remove();
            }, [enabled]);
            ctx.setStatus(enabled ? 'CSS désactivé sur la page.' : 'CSS réactivé sur la page.');
            ctx.rerenderTechnical();
        }

        if (tool === 'highlight-links') {
            ctx.techToolsState.linksHighlighted = !ctx.techToolsState.linksHighlighted;
            const enabled = ctx.techToolsState.linksHighlighted;
            await ctx.executeScript(tabId, (isEnabled) => {
                const id = '__ds_highlight_links_style__';
                let el = document.getElementById(id);
                if (isEnabled) {
                    if (!el) {
                        el = document.createElement('style'); el.id = id;
                        el.textContent = 'a[href]{outline:2px dashed #f1fd0d !important; background:rgba(241,253,13,.16)!important;}';
                        document.documentElement.appendChild(el);
                    }
                    return;
                }
                el?.remove();
            }, [enabled]);
            ctx.setStatus(enabled ? 'Liens surlignés sur la page.' : 'Surlignage des liens retiré.');
            ctx.rerenderTechnical();
        }
    };

    const renderTechnical = (container, data) => {
        if (!container) return;
        const pagespeedUrl = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(data?.url || '')}`;
        const gtmetrixUrl = `https://gtmetrix.com/?url=${encodeURIComponent(data?.url || '')}`;
        const toolLabel = (name, active = false) => `${active ? '✓ ' : ''}${name}`;
        const state = ctx.techToolsState;

        container.innerHTML = `
            <div class="tech-dashboard-grid">
                <div class="tech-main-stack">
                    <div class="card tech-tools-card">
                        <h3>Outils Visuels & Techniques</h3>
                        <div class="tech-tools-grid">
                            <button type="button" class="tech-tool-btn" data-tech-tool="disable-css">${toolLabel('Désactiver CSS', state.cssDisabled)}</button>
                            <button type="button" class="tech-tool-btn" data-tech-tool="highlight-links">${toolLabel('Surligner Liens', state.linksHighlighted)}</button>
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
            </div>`;

        Array.from(container.querySelectorAll('[data-tech-tool]')).forEach((btn) => {
            btn.addEventListener('click', async () => {
                const tool = btn.getAttribute('data-tech-tool');
                if (!tool) return;
                try { await runToolAction(tool); }
                catch (err) { ctx.setStatus(`Action technique échouée: ${err?.message || 'erreur inconnue'}`); }
            });
        });

        fetchTechnicalInfo(data?.url).then((info) => {
            const robotsBadge = container.querySelector('#tech-robots-badge');
            const sitemapBadge = container.querySelector('#tech-sitemap-badge');
            const robotsContent = container.querySelector('#tech-robots-content');
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

    const renderTechnologies = (container, data) => {
        if (!container) return;
        const techs = data?.technologies || {};

        const normalizeClassName = (v) => String(v || '').toLowerCase().normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

        const buildLogoToken = (name, category) => {
            const source = String(name || '').trim();
            if (!source) return '??';
            if (category === 'Scripts') return 'JS';
            const compact = source.replace(/[^a-zA-Z0-9]/g, '');
            return compact.length <= 3 ? compact.toUpperCase() : compact.slice(0, 2).toUpperCase();
        };

        const localLogoMap = {
            wordpress: 'assets/tech-logos/wordpress.svg', shopify: 'assets/tech-logos/shopify.svg',
            drupal: 'assets/tech-logos/drupal.svg', prestashop: 'assets/tech-logos/prestashop.svg',
            elementor: 'assets/tech-logos/elementor.svg', rankmath: 'assets/tech-logos/rankmath.svg',
            'rank-math': 'assets/tech-logos/rankmath.svg', jquery: 'assets/tech-logos/jquery.svg'
        };
        const slugMap = globalThis.TechLogoAliasesV2 || {};

        const inferLogoSlug = (name) => {
            const key = normalizeClassName(name);
            if (!key) return '';
            if (slugMap[key]) return slugMap[key];
            const byContains = Object.keys(slugMap).find((a) => key.includes(a));
            if (byContains) return slugMap[byContains];
            const ignoreParts = new Set(['min', 'js', 'css', 'cdn', 'wp', 'includes', 'content', 'themes', 'theme']);
            const parts = key.split('-').filter((p) => p && !ignoreParts.has(p));
            const mapped = parts.find((p) => slugMap[p]);
            return mapped ? slugMap[mapped] : (parts[0] || key);
        };

        const buildCandidates = (name) => {
            const key = normalizeClassName(name);
            const localPath = localLogoMap[key] || (key.includes('jquery') ? localLogoMap.jquery : '');
            const candidates = localPath ? [chrome.runtime.getURL(localPath)] : [];
            const slug = inferLogoSlug(name);
            if (slug) {
                candidates.push(`https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${slug}/${slug}-original.svg`);
                candidates.push(`https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${slug}/${slug}-plain.svg`);
                candidates.push(`https://cdn.simpleicons.org/${slug}`);
            }
            return candidates;
        };

        const renderGroup = (title, group) => {
            const items = Array.isArray(group?.items) ? group.items : [];
            const list = items.length ? items.map((item) => {
                const rawName = item?.name || '';
                const version = item?.version ? String(item.version) : '';
                const token = buildLogoToken(rawName, title);
                const candidates = buildCandidates(rawName);
                const firstLogo = candidates[0] || '';
                const encodedCandidates = candidates.map((u) => encodeURIComponent(u)).join('|');
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
                    </div>`;
            }).join('') : '<div class="hint">Non détecté</div>';
            return `<div class="tech-category tech-category-large"><h4>${title}</h4>${list}</div>`;
        };

        container.innerHTML = `
            <div class="tech-grid">
                ${renderGroup('CMS', techs.cms)}
                ${renderGroup('Thème', techs.theme)}
                ${renderGroup('Plugins', techs.plugin)}
                ${renderGroup('Scripts', techs.script)}
            </div>`;

        Array.from(container.querySelectorAll('img[data-tech-logo]')).forEach((img) => {
            img.addEventListener('load', () => {
                const box = img.closest('[data-tech-logo-box]');
                box?.classList.replace('is-missing', 'has-img');
            });
            img.addEventListener('error', () => {
                const candidates = String(img.dataset.techCandidates || '').split('|').map((v) => v && decodeURIComponent(v)).filter(Boolean);
                const nextIndex = (Number.parseInt(String(img.dataset.logoIndex || '0'), 10) || 0) + 1;
                if (nextIndex < candidates.length) {
                    img.dataset.logoIndex = String(nextIndex);
                    img.src = candidates[nextIndex];
                    return;
                }
                const box = img.closest('[data-tech-logo-box]');
                box?.classList.replace('has-img', 'is-missing');
            });
        });
    };

    function init(context) { ctx = context; }

    globalThis.PopupTechnicalV2 = Object.freeze({ init, renderTechnical, renderTechnologies });
})();
