(() => {
    const injectStyles = () => {
        if (document.getElementById('meta-v2-styles')) return;
        const style = document.createElement('style');
        style.id = 'meta-v2-styles';
        style.textContent = `
            .meta-v2 { display:grid; gap:14px; }
            .meta-v2-tabs { display:flex; gap:18px; border-bottom:2px solid #d7dee3; padding-bottom:6px; }
            .meta-v2-tab { border:none; background:none; color:#6c7277; font-size:14px; font-weight:700; cursor:pointer; padding:4px 0; }
            .meta-v2-tab.is-active { color:#1b2d33; border-bottom:3px solid #1b2d33; }
            .meta-v2-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
            .meta-v2-title { margin:0; font-size:16px; line-height:1.03; border-bottom:2px solid #9bd4de; padding-bottom:8px; }
            .meta-v2-actions { display:flex; gap:8px; }
            .meta-v2-panel { display:none; }
            .meta-v2-panel.is-active { display:block; }
            .meta-v2-table { border:1px solid #d1d8dc; border-radius:10px; overflow:hidden; background:#fff; }
            .meta-v2-row { display:grid; grid-template-columns:190px 1fr; border-bottom:1px solid #e4eaee; }
            .meta-v2-row:last-child { border-bottom:none; }
            .meta-v2-key { padding:12px; background:#f5f7f8; font-weight:700; color:#2b3a41; border-right:1px solid #dde3e7; text-transform:lowercase; }
            .meta-v2-value { padding:12px; color:#2d353a; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; word-break:break-word; white-space:pre-wrap; }
            body.theme-dark .meta-v2-tab { color:#9ab0c0; }
            body.theme-dark .meta-v2-tab.is-active { color:#e3ecf4; border-color:#e3ecf4; }
            body.theme-dark .meta-v2-title { color:#e3ecf4; border-color:#3f6074; }
            body.theme-dark .meta-v2-table { background:var(--dark-card); border-color:var(--dark-border); }
            body.theme-dark .meta-v2-row { border-color:#374a5c; }
            body.theme-dark .meta-v2-key { background:#243240; border-color:#3a4e62; color:#d7e2ec; }
            body.theme-dark .meta-v2-value { color:#d0dbe6; }
        `;
        document.head.appendChild(style);
    };

    const MetadataModuleV2 = {
        prepare(data) {
            const h = (val) => (val && val !== '-' ? val : '-');
            return {
                general: {
                    viewport: h(data.viewport),
                    keywords: h(data.keywords),
                    publisher: h(data.publisher),
                    description: h(data.metaDescription),
                    robots: h(data.robots),
                    canonical: h(data.canonical),
                    lang: h(data.lang),
                    jsonLd: data.jsonLdCount > 0 ? `${data.jsonLdCount} balise(s)` : '-',
                    hreflang: data.hreflang?.length > 0 ? `${data.hreflang.length} langue(s)` : '-'
                },
                social: {
                    ogTitle: h(data.openGraph?.title),
                    ogImage: h(data.openGraph?.image),
                    ogUrl: h(data.openGraph?.url),
                    twitterCard: h(data.twitterCard?.card),
                    twitterTitle: h(data.twitterCard?.title)
                }
            };
        },

        render(container, data) {
            if (!container) return;
            injectStyles();

            const prepared = this.prepare(data);
            const createRows = (rows) => rows.map(([label, value]) => `
                <div class="meta-v2-row">
                    <div class="meta-v2-key">${label}</div>
                    <div class="meta-v2-value">${value}</div>
                </div>
            `).join('');

            const generalRows = [
                ['viewport', prepared.general.viewport],
                ['keywords', prepared.general.keywords],
                ['publisher', prepared.general.publisher],
                ['description', prepared.general.description],
                ['robots', prepared.general.robots],
                ['canonical', prepared.general.canonical],
                ['lang', prepared.general.lang],
                ['json-ld', prepared.general.jsonLd],
                ['hreflang', prepared.general.hreflang]
            ];

            const socialRows = [
                ['og:title', prepared.social.ogTitle],
                ['og:image', prepared.social.ogImage],
                ['og:url', prepared.social.ogUrl],
                ['twitter:card', prepared.social.twitterCard],
                ['twitter:title', prepared.social.twitterTitle]
            ];

            const toCsv = (rows) => rows
                .map((line) => line.map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(','))
                .join('\n');

            const downloadText = (filename, mimeType, content) => {
                const blob = new Blob([content], { type: mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 400);
            };

            container.innerHTML = `
                <div class="meta-v2">
                    <div class="meta-v2-tabs">
                        <button type="button" class="meta-v2-tab is-active" data-meta-tab="general">Général</button>
                        <button type="button" class="meta-v2-tab" data-meta-tab="social">Social / Twitter</button>
                    </div>
                    <div class="meta-v2-head">
                        <h3 class="meta-v2-title">Métadonnées Générales</h3>
                        <div class="meta-v2-actions">
                            <button type="button" class="btn btn-secondary" id="meta-export-excel">📊 Excel</button>
                            <button type="button" class="btn btn-primary" id="meta-export-pdf">📄 PDF</button>
                        </div>
                    </div>
                    <div id="meta-panel-general" class="meta-v2-panel is-active">
                        <div class="meta-v2-table">${createRows(generalRows)}</div>
                    </div>
                    <div id="meta-panel-social" class="meta-v2-panel">
                        <div class="meta-v2-table">${createRows(socialRows)}</div>
                    </div>
                </div>
            `;

            const tabs = Array.from(container.querySelectorAll('[data-meta-tab]'));
            const title = container.querySelector('.meta-v2-title');

            tabs.forEach((tab) => {
                tab.addEventListener('click', () => {
                    const name = tab.getAttribute('data-meta-tab') || 'general';
                    tabs.forEach((btn) => btn.classList.remove('is-active'));
                    tab.classList.add('is-active');

                    container.querySelector('#meta-panel-general')?.classList.toggle('is-active', name === 'general');
                    container.querySelector('#meta-panel-social')?.classList.toggle('is-active', name === 'social');
                    if (title) title.textContent = name === 'social' ? 'Social / Twitter' : 'Métadonnées Générales';
                });
            });

            const exportRows = () => {
                const socialActive = container.querySelector('#meta-panel-social')?.classList.contains('is-active');
                const rows = socialActive ? socialRows : generalRows;
                return [['Champ', 'Valeur'], ...rows];
            };

            container.querySelector('#meta-export-csv')?.addEventListener('click', () => {
                downloadText('meta.csv', 'text/csv;charset=utf-8', toCsv(exportRows()));
            });

            container.querySelector('#meta-export-excel')?.addEventListener('click', () => {
                const rows = exportRows();
                const html = `<table>${rows.map((row) => `<tr>${row.map((col) => `<td>${esc(col)}</td>`).join('')}</tr>`).join('')}</table>`;
                downloadText('meta.xls', 'application/vnd.ms-excel;charset=utf-8', html);
            });

            container.querySelector('#meta-export-pdf')?.addEventListener('click', () => {
                const rows = exportRows();
                const printable = window.open('', '_blank');
                if (!printable) return;
                printable.document.write(`<html><head><title>Meta</title></head><body><table border="1" cellspacing="0" cellpadding="6">${rows.map((row) => `<tr>${row.map((col) => `<td>${esc(col)}</td>`).join('')}</tr>`).join('')}</table></body></html>`);
                printable.document.close();
                printable.focus();
                printable.print();
            });
        }
    };

    globalThis.MetadataModuleV2 = MetadataModuleV2;
})();