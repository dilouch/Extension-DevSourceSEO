(() => {
	const esc = (value) => globalThis.DomV2?.escapeHtml
		? globalThis.DomV2.escapeHtml(value)
		: String(value ?? '');

	const prepare = (data = {}) => {
		const imageDetails = Array.isArray(data.imageDetails) ? data.imageDetails : [];
		const fallbackImages = String(data.images || '')
			.split(' | ')
			.map((src) => ({ src, alt: '', width: 0, height: 0, loading: '' }))
			.filter((item) => item.src);
		const items = imageDetails.length ? imageDetails : fallbackImages;
		const missingAlt = items.filter((item) => !String(item.alt || '').trim()).length;
		const lazy = items.filter((item) => String(item.loading || '').toLowerCase() === 'lazy').length;
		return {
			items,
			counts: {
				total: items.length,
				missingAlt,
				lazy
			}
		};
	};

	const buildImageRows = (items) => {
		if (!items.length) return '<li class="image-item-empty">Aucune image dans ce filtre.</li>';
		return items.slice(0, 50).map((item) => `
			<li class="image-item">
				<div class="image-thumb">
					<img src="${esc(item.src)}" alt="${esc(item.alt || 'Image')}">
				</div>
				<div class="image-meta">
					<div class="image-url">${esc(item.src)}</div>
					<div class="image-alt ${!item.alt ? 'image-alt-missing' : ''}">Alt: ${esc(item.alt || '⚠ absent')}</div>
					<div class="image-dim">${Number(item.width || 0)} x ${Number(item.height || 0)}${item.loading ? ` • ${esc(item.loading)}` : ''}</div>
				</div>
			</li>
		`).join('');
	};

	const render = (container, data) => {
		if (!container) return;
		const prepared = prepare(data);
		if (!prepared.items.length) {
			container.innerHTML = '<div class="hint">Aucune image détectée.</div>';
			return;
		}

		container.innerHTML = `
			<div style="display:flex; justify-content:flex-end; gap:6px; margin-bottom:8px;">
				<button type="button" id="images-export-csv" class="btn btn-secondary" title="Exporter en CSV (Excel)">📊 Excel</button>
				<button type="button" id="images-export-pdf" class="btn btn-primary" title="Exporter en PDF">📄 PDF</button>
			</div>
			<div class="mini-kpi-grid">
				<button type="button" class="mini-kpi img-filter-btn ${!prepared.counts.total ? 'is-disabled' : ''}" data-img-filter="all">
					<span class="mini-kpi-label">Images</span>
					<span class="mini-kpi-value">${prepared.counts.total}</span>
				</button>
				<button type="button" class="mini-kpi img-filter-btn ${!prepared.counts.missingAlt ? 'is-disabled' : ''}" data-img-filter="missing-alt">
					<span class="mini-kpi-label">Alt manquants</span>
					<span class="mini-kpi-value">${prepared.counts.missingAlt}</span>
				</button>
				<button type="button" class="mini-kpi img-filter-btn ${!prepared.counts.lazy ? 'is-disabled' : ''}" data-img-filter="lazy">
					<span class="mini-kpi-label">Lazy</span>
					<span class="mini-kpi-value">${prepared.counts.lazy}</span>
				</button>
			</div>
			<div class="img-filter-label" id="img-filter-label" style="font-size:12px;font-weight:700;color:#6c7d85;text-transform:uppercase;letter-spacing:.04em;margin:10px 0 6px;">Toutes les images (${prepared.counts.total})</div>
			<ul class="image-list" id="img-list">${buildImageRows(prepared.items)}</ul>
		`;

		let activeFilter = 'all';
		const listEl = container.querySelector('#img-list');
		const labelEl = container.querySelector('#img-filter-label');

		const applyFilter = (filter) => {
			activeFilter = filter;
			let filtered;
			let label;
			if (filter === 'missing-alt') {
				filtered = prepared.items.filter((item) => !String(item.alt || '').trim());
				label = `Alt manquants (${filtered.length})`;
			} else if (filter === 'lazy') {
				filtered = prepared.items.filter((item) => String(item.loading || '').toLowerCase() === 'lazy');
				label = `Lazy loading (${filtered.length})`;
			} else {
				filtered = prepared.items;
				label = `Toutes les images (${prepared.counts.total})`;
			}
			if (listEl) listEl.innerHTML = buildImageRows(filtered);
			if (labelEl) labelEl.textContent = label;
			Array.from(container.querySelectorAll('.img-filter-btn')).forEach((btn) => {
				btn.classList.toggle('is-active', btn.getAttribute('data-img-filter') === filter);
			});
		};

		Array.from(container.querySelectorAll('.img-filter-btn')).forEach((btn) => {
			btn.addEventListener('click', () => {
				const f = btn.getAttribute('data-img-filter') || 'all';
				applyFilter(activeFilter === f ? 'all' : f);
			});
		});

		applyFilter('all');

		const getFiltered = () => {
			if (activeFilter === 'missing-alt') return prepared.items.filter((i) => !String(i.alt || '').trim());
			if (activeFilter === 'lazy') return prepared.items.filter((i) => String(i.loading || '').toLowerCase() === 'lazy');
			return prepared.items;
		};

		container.querySelector('#images-export-csv')?.addEventListener('click', () => {
			const items = getFiltered();
			const escCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
			const rows = [
				['URL', 'Alt', 'Largeur', 'Hauteur', 'Loading'],
				...items.map((i) => [i.src, i.alt || '', i.width || 0, i.height || 0, i.loading || ''])
			].map((r) => r.map(escCsv).join(',')).join('\r\n');
			const csv = '\ufeff' + rows;
			const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `images-${activeFilter}.csv`;
			a.click();
			setTimeout(() => URL.revokeObjectURL(url), 300);
		});

		container.querySelector('#images-export-pdf')?.addEventListener('click', () => {
			const items = getFiltered();
			const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Export Images</title>
				<style>
					body{font-family:Arial,sans-serif;padding:20px;color:#222;}
					h1{font-size:18px;margin:0 0 12px;}
					.meta{color:#666;font-size:12px;margin-bottom:16px;}
					table{width:100%;border-collapse:collapse;font-size:11px;}
					th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top;word-break:break-word;}
					th{background:#f1f1f1;}
					tr:nth-child(even) td{background:#fafafa;}
					.thumb{max-width:80px;max-height:60px;}
					.missing{color:#c0392b;font-weight:bold;}
				</style></head><body>
				<h1>Export Images — ${esc(activeFilter)}</h1>
				<div class="meta">${items.length} images · Généré le ${new Date().toLocaleString('fr-FR')}</div>
				<table><thead><tr><th>Aperçu</th><th>URL</th><th>Alt</th><th>Dimensions</th><th>Loading</th></tr></thead><tbody>
				${items.map((i) => `<tr><td><img class="thumb" src="${esc(i.src)}" alt=""></td><td>${esc(i.src)}</td><td>${i.alt ? esc(i.alt) : '<span class="missing">⚠ absent</span>'}</td><td>${Number(i.width || 0)} × ${Number(i.height || 0)}</td><td>${esc(i.loading || '-')}</td></tr>`).join('')}
				</tbody></table>
				<script>window.onload=()=>setTimeout(()=>window.print(),500);<\/script>
				</body></html>`;
			const win = window.open('', '_blank');
			if (win) { win.document.write(html); win.document.close(); }
		});
	};

	globalThis.ImagesModuleV2 = Object.freeze({
		prepare,
		render
	});
})();