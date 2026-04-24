(() => {
    let ctx = null;

    const esc = (v) => globalThis.UtilsV2?.escapeHtml ? globalThis.UtilsV2.escapeHtml(v) : String(v ?? '');

    // Enregistré UNE SEULE FOIS dans init() — plus de fuite à chaque render
    let storageListenerBound = false;

    const render = (container, data) => {
        if (!container || !data) return;

        const lastAuditResult = ctx.getLastAuditResult();
        const lastNetworkInfo = ctx.getLastNetworkInfo();

        const titleLength = String(data.title || '').length;
        const descLength = String(data.metaDescription || '').length;
        const auditScore = lastAuditResult?.score ?? null;
        const scoreValue = auditScore === null ? '...' : String(auditScore);
        const scoreGrade = auditScore === null ? 'F'
            : auditScore >= 90 ? 'A' : auditScore >= 75 ? 'B'
            : auditScore >= 60 ? 'C' : auditScore >= 45 ? 'D' : 'F';
        const scoreClass = auditScore === null ? 'score-f'
            : auditScore >= 90 ? 'score-a' : auditScore >= 75 ? 'score-b'
            : auditScore >= 60 ? 'score-c' : auditScore >= 45 ? 'score-d' : 'score-f';
        const netIp = esc(lastNetworkInfo?.ip || 'Detection...');
        const netCdn = esc(lastNetworkInfo?.cdn || 'Detection...');
        const keywordList = Array.isArray(data.words) && data.words.length
            ? data.words.slice(0, 6).map((item) => `<span class="meta-badge clickable">${esc(item.word)} <strong>${Number(item.count || 0)}</strong></span>`).join('')
            : '<span class="meta-badge">Aucun mot-clé</span>';

        container.innerHTML = `
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
                        <div class="card-header">
                            <span class="label">URL Canonique</span>
                            <span id="canonical-tag" class="tag">${data.canonical ? 'OK' : 'Manquant'}</span>
                            <button id="copy-canonical-btn" class="btn btn-icon" data-copy-value="${esc(data.canonical || '')}" title="Copier l'URL canonique">📋</button>
                        </div>
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
                        <p id="score-issues" class="score-issues">${lastAuditResult ? `OK ${lastAuditResult.stats.ok} • Warn ${lastAuditResult.stats.warning} • Err ${lastAuditResult.stats.error}` : 'Lance l\'audit pour calculer le score'}</p>
                    </div>

                    <div class="card">
                        <h3>Stats Page</h3>
                        <div class="stats-grid">
                            <div class="stat-item clickable" id="stat-words-clickable" title="Voir l'analyse des mots">
                                <span id="stats-words" class="stat-value" style="color:var(--color-blue);text-decoration:underline;">${Number(data.wordCount || 0)}</span>
                                <span class="stat-label">mots (cliquer)</span>
                            </div>
                            <div class="stat-item clickable" title="Voir les redirections">
                                <span id="stats-status-code" class="stat-value" style="color:var(--color-blue);text-decoration:underline;">${lastNetworkInfo?.server ? 'Info' : '...'}</span>
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
                            <div class="tech-sidebar-item"><span class="label">Thème:</span><span id="stats-theme" class="value clickable">${esc(data.technologies?.theme?.items?.[0]?.name || '...')}</span></div>
                        </div>
                        <div style="margin-top:10px;border-top:1px dashed #eee;padding-top:5px;">
                            <span class="label" style="font-size:12px;color:#666;font-weight:bold;display:block;margin-bottom:5px;">Extensions:</span>
                            <div id="sidebar-plugins-list" style="font-size:12px;color:#333;line-height:1.4;">
                                ${(data.technologies?.plugin?.items || []).slice(0, 4).map((item) => esc(item.name)).join('<br>') || '...'}
                            </div>
                        </div>
                        <div style="margin-top:15px;border-top:1px dashed #eee;padding-top:10px;">
                            <h4 style="margin:0 0 10px;font-size:13px;color:var(--color-dark-2);">Top Mots-clés</h4>
                            <div id="sidebar-keywords-list" class="meta-badges">${keywordList}</div>
                        </div>
                    </div>
                </div>
            </div>`;

        container.querySelectorAll('[data-copy-value]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const value = btn.getAttribute('data-copy-value') || '';
                try { await ctx.copyText(value); ctx.setStatus('Texte copié.'); }
                catch (_) { ctx.setStatus('Impossible de copier.'); }
            });
        });

        container.querySelector('#btn-toggle-nofollow-quick')?.addEventListener('click', ctx.toggleCurrentSiteNofollow);
    };

    function init(context) {
        ctx = context;

        // Bind UNE SEULE FOIS — FIX du bug de fuite de listeners
        if (!storageListenerBound) {
            storageListenerBound = true;
            try {
                chrome.storage.onChanged.addListener((changes, area) => {
                    if (area === 'local' && changes[ctx.NOFOLLOW_STORAGE_KEY]) {
                        ctx.updateNofollowTopbarButton();
                    }
                });
            } catch (_) {}
        }
    }

    globalThis.PopupOverviewV2 = Object.freeze({ init, render });
})();
