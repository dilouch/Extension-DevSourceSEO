// Module de l'onglet Sauvegardes : enregistrement, export et suppression des analyses.
(() => {
    let ctx = null;

    const esc = (v) => globalThis.UtilsV2?.escapeHtml ? globalThis.UtilsV2.escapeHtml(v) : String(v ?? '');

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
            </div>`).join('');

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
            </div>`;

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

    const refresh = async () => {
        const container = document.getElementById('saved-list');
        if (!container) return;
        const entries = await ctx.storageGet(ctx.STORAGE_KEY);
        const saves = Array.isArray(entries) ? entries : [];
        if (!saves.length) {
            container.innerHTML = '<div class="hint">Aucune sauvegarde pour le moment.</div>';
            return;
        }
        container.innerHTML = saves.map((item, idx) => {
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
            </div>`;
        }).join('');

        Array.from(container.querySelectorAll('.save-item-clickable')).forEach((el) => {
            const open = () => {
                const idx = Number(el.getAttribute('data-save-index'));
                if (saves[idx]) openSaveModal(saves[idx]);
            };
            el.addEventListener('click', open);
            el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(); });
        });
    };

    const save = async () => {
        const data = ctx.getLastData();
        if (!data) { ctx.setStatus('Aucune analyse à sauvegarder.'); return; }
        const now = new Date();
        const entry = {
            id: String(now.getTime()),
            createdAt: now.toISOString(),
            createdLabel: now.toLocaleString('fr-FR'),
            url: data.url,
            title: data.title,
            wordCount: data.wordCount,
            score: ctx.getLastAuditResult()?.score || 0,
            data
        };
        const current = await ctx.storageGet(ctx.STORAGE_KEY);
        const list = Array.isArray(current) ? current : [];
        list.unshift(entry);
        await ctx.storageSet(ctx.STORAGE_KEY, list.slice(0, ctx.MAX_SAVES));
        await refresh();
        ctx.setStatus('Analyse sauvegardée.');
    };

    const exportAll = async () => {
        const entries = await ctx.storageGet(ctx.STORAGE_KEY);
        const list = Array.isArray(entries) ? entries : [];
        if (!list.length) { ctx.setStatus('Aucune sauvegarde à exporter.'); return; }
        const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
        const date = new Date().toISOString().slice(0, 10);
        globalThis.UtilsV2.downloadBlob(blob, `devsource-sauvegardes-${date}.json`);
        ctx.setStatus('Export JSON lancé.');
    };

    const clear = async () => {
        await ctx.storageSet(ctx.STORAGE_KEY, []);
        await refresh();
        ctx.setStatus('Sauvegardes vidées.');
    };

    function init(context) { ctx = context; }

    globalThis.PopupSavesV2 = Object.freeze({ init, refresh, save, exportAll, clear });
})();
