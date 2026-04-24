(() => {
	const esc = (value) => globalThis.DomV2?.escapeHtml
		? globalThis.DomV2.escapeHtml(value)
		: String(value ?? '');

	const toCount = (value) => {
		const n = Number(value);
		return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
	};

	function prepare(data = {}) {
		const linkDetails = data.linkDetails && typeof data.linkDetails === 'object' ? data.linkDetails : {};
		const summary = linkDetails.summary && typeof linkDetails.summary === 'object' ? linkDetails.summary : {};
		const all = Array.isArray(linkDetails.all) ? linkDetails.all : [];

		return {
			summary: {
				total: toCount(summary.total),
				internal: toCount(summary.internal),
				external: toCount(summary.external),
				nofollow: toCount(summary.nofollow)
			},
			all: all
				.filter((item) => item && item.href)
				.map((item) => ({
					href: String(item.href || ''),
					text: String(item.text || '').trim(),
					nofollow: Boolean(item.nofollow),
					isInternal: Boolean(item.isInternal),
					target: String(item.target || '').trim()
				}))
		};
	}

	function renderRows(items) {
		if (!items.length) {
			return '<div class="links-list-row"><div class="col-link-url">Aucun lien détecté</div><div class="col-link-text">-</div><div class="col-link-type">-</div><div class="col-link-rel">-</div><div class="col-link-target">-</div></div>';
		}

		return items.map((item) => {
			const typeClass = item.isInternal ? 'type-interne' : 'type-externe';
			const typeLabel = item.isInternal ? 'Interne' : 'Externe';
			const relLabel = item.nofollow ? 'nofollow' : '-';
			const textLabel = item.text || '-';
			const targetLabel = item.target || '-';

			return `
				<div class="links-list-row">
					<div class="col-link-url"><a href="${esc(item.href)}" target="_blank" rel="noopener noreferrer">${esc(item.href)}</a></div>
					<div class="col-link-text">${esc(textLabel)}</div>
					<div class="col-link-type"><span class="${typeClass}">${typeLabel}</span></div>
					<div class="col-link-rel">${relLabel}</div>
					<div class="col-link-target">${esc(targetLabel)}</div>
				</div>
			`;
		}).join('');
	}

	function render(container, data) {
		if (!container) return;

		const prepared = prepare(data);

		container.innerHTML = `
			<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
				<h3 style="margin:0;">Liens</h3>
				<div class="btn-row" style="display:flex; gap:6px;">
					<button type="button" id="links-export-csv" class="btn btn-secondary" title="Exporter en CSV (Excel)">📊 Excel</button>
					<button type="button" id="links-export-pdf" class="btn btn-primary" title="Exporter en PDF">📄 PDF</button>
				</div>
			</div>
			<div class="mini-kpi-grid">
				<button type="button" class="mini-kpi links-filter-btn" data-links-filter="all">
					<span class="mini-kpi-label">Total</span>
					<span class="mini-kpi-value">${prepared.summary.total}</span>
				</button>
				<button type="button" class="mini-kpi links-filter-btn" data-links-filter="internal">
					<span class="mini-kpi-label">Internes</span>
					<span class="mini-kpi-value">${prepared.summary.internal}</span>
				</button>
				<button type="button" class="mini-kpi links-filter-btn" data-links-filter="external">
					<span class="mini-kpi-label">Externes</span>
					<span class="mini-kpi-value">${prepared.summary.external}</span>
				</button>
				<button type="button" class="mini-kpi links-filter-btn ${!prepared.summary.nofollow ? 'is-disabled' : ''}" data-links-filter="nofollow">
					<span class="mini-kpi-label">Nofollow</span>
					<span class="mini-kpi-value">${prepared.summary.nofollow}</span>
				</button>
			</div>
			<div class="links-filter-label" id="links-filter-label" style="font-size:12px;font-weight:700;color:#6c7d85;text-transform:uppercase;letter-spacing:.04em;margin:10px 0 6px;">Tous les liens (${prepared.summary.total})</div>
			<div class="links-list-container" style="max-height:420px; overflow:auto;">
				<div class="links-list-header">
					<div>URL</div>
					<div>Texte</div>
					<div>Type</div>
					<div>Rel</div>
					<div>Target</div>
				</div>
				<div id="links-rows">${renderRows(prepared.all)}</div>
			</div>
		`;

		let activeFilter = 'all';
		const rowsEl = container.querySelector('#links-rows');
		const labelEl = container.querySelector('#links-filter-label');

		const applyFilter = (filter) => {
			activeFilter = filter;
			let items;
			let label;
			if (filter === 'internal') {
				items = prepared.all.filter((item) => item.isInternal);
				label = `Liens internes (${items.length})`;
			} else if (filter === 'external') {
				items = prepared.all.filter((item) => !item.isInternal);
				label = `Liens externes (${items.length})`;
			} else if (filter === 'nofollow') {
				items = prepared.all.filter((item) => item.nofollow);
				label = `Liens nofollow (${items.length})`;
			} else {
				items = prepared.all;
				label = `Tous les liens (${prepared.summary.total})`;
			}
			if (rowsEl) rowsEl.innerHTML = renderRows(items);
			if (labelEl) labelEl.textContent = label;
			Array.from(container.querySelectorAll('.links-filter-btn')).forEach((btn) => {
				btn.classList.toggle('is-active', btn.getAttribute('data-links-filter') === filter);
			});
		};

		Array.from(container.querySelectorAll('.links-filter-btn')).forEach((btn) => {
			btn.addEventListener('click', () => {
				const f = btn.getAttribute('data-links-filter') || 'all';
				applyFilter(activeFilter === f ? 'all' : f);
			});
		});

		applyFilter('all');

		const getFiltered = () => {
			if (activeFilter === 'internal') return prepared.all.filter((i) => i.isInternal);
			if (activeFilter === 'external') return prepared.all.filter((i) => !i.isInternal);
			if (activeFilter === 'nofollow') return prepared.all.filter((i) => i.nofollow);
			return prepared.all;
		};

		container.querySelector('#links-export-csv')?.addEventListener('click', () => {
			const items = getFiltered();
			const escCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
			const rows = [
				['URL', 'Texte', 'Type', 'Rel', 'Target'],
				...items.map((i) => [i.href, i.text, i.isInternal ? 'Interne' : 'Externe', i.nofollow ? 'nofollow' : '', i.target])
			].map((r) => r.map(escCsv).join(',')).join('\r\n');
			const csv = '\ufeff' + rows; // BOM pour Excel UTF-8
			const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `liens-${activeFilter}.csv`;
			a.click();
			setTimeout(() => URL.revokeObjectURL(url), 300);
		});

		container.querySelector('#links-export-pdf')?.addEventListener('click', () => {
			const items = getFiltered();
			const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Export Liens</title>
				<style>
					body{font-family:Arial,sans-serif;padding:20px;color:#222;}
					h1{font-size:18px;margin:0 0 12px;}
					.meta{color:#666;font-size:12px;margin-bottom:16px;}
					table{width:100%;border-collapse:collapse;font-size:11px;}
					th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top;word-break:break-word;}
					th{background:#f1f1f1;}
					tr:nth-child(even) td{background:#fafafa;}
					.tag-no{color:#c0392b;font-weight:bold;}
				</style></head><body>
				<h1>Export Liens — ${esc(activeFilter)}</h1>
				<div class="meta">${items.length} liens · Généré le ${new Date().toLocaleString('fr-FR')}</div>
				<table><thead><tr><th>URL</th><th>Texte</th><th>Type</th><th>Rel</th><th>Target</th></tr></thead><tbody>
				${items.map((i) => `<tr><td>${esc(i.href)}</td><td>${esc(i.text)}</td><td>${i.isInternal ? 'Interne' : 'Externe'}</td><td>${i.nofollow ? '<span class="tag-no">nofollow</span>' : '-'}</td><td>${esc(i.target || '-')}</td></tr>`).join('')}
				</tbody></table>
				<script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script>
				</body></html>`;
			const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
				chrome.tabs.create({ url });
			} else {
				const win = window.open(url, '_blank');
				if (!win) alert('Ouverture bloquée par le navigateur.');
			}
			setTimeout(() => URL.revokeObjectURL(url), 60000);
		});
	}

	globalThis.LinksModuleV2 = {
		prepare,
		render
	};
})();