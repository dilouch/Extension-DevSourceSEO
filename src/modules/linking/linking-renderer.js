(() => {
	const esc = (value) => globalThis.DomV2?.escapeHtml
		? globalThis.DomV2.escapeHtml(value)
		: String(value ?? '');

	function renderPlaceholder(container, message) {
		if (!container) return;
		container.innerHTML = `<p class="linking-empty" style="padding:14px;color:#6c7d85;font-size:12px;text-align:center;">${esc(message)}</p>`;
	}

	function renderError(container, message) {
		if (!container) return;
		container.innerHTML = `<div class="linking-error" style="padding:12px;border:1px solid #e74c3c;background:#fdecea;color:#c0392b;border-radius:6px;font-size:12px;">⚠️ ${esc(message)}</div>`;
	}

	function renderLoading(container, message) {
		if (!container) return;
		container.innerHTML = `<div class="linking-loading" style="padding:14px;text-align:center;color:#6c7d85;font-size:12px;">⏳ ${esc(message || 'Chargement...')}</div>`;
	}

	function renderSingle(container, item, checkedAt) {
		if (!container) return;
		if (!item) {
			renderPlaceholder(container, 'Aucune donnée Linking pour ce domaine.');
			return;
		}

		const date = checkedAt ? new Date(checkedAt).toLocaleString() : 'Maintenant';
		container.innerHTML = `
			<div class="linking-meta">Derniere analyse: <strong>${esc(date)}</strong></div>
			<div class="metric-grid-4">
				<div class="metric-box"><span class="value">${esc(item.TrustFlow ?? 0)}</span><span class="label">TF</span></div>
				<div class="metric-box"><span class="value">${esc(item.CitationFlow ?? 0)}</span><span class="label">CF</span></div>
				<div class="metric-box"><span class="value">${esc(item.RefDomains ?? 0)}</span><span class="label">RD</span></div>
				<div class="metric-box"><span class="value">${esc(item.ExtBackLinks ?? 0)}</span><span class="label">BL</span></div>
			</div>
		`;
	}

	function renderBulk(container, items) {
		if (!container) return;
		if (!items || !items.length) {
			container.innerHTML = '<p class="linking-empty">Aucun résultat bulk.</p>';
			return;
		}

		const rows = items.map((item) => `
			<tr>
				<td>${esc(item.Item || '-')}</td>
				<td>${esc(item.TrustFlow ?? 0)}</td>
				<td>${esc(item.CitationFlow ?? 0)}</td>
				<td>${esc(item.RefDomains ?? 0)}</td>
				<td>${esc(item.ExtBackLinks ?? 0)}</td>
			</tr>
		`).join('');

		container.innerHTML = `
			<table class="linking-table">
				<thead>
					<tr>
						<th>Domaine</th>
						<th>TF</th>
						<th>CF</th>
						<th>RD</th>
						<th>BL</th>
					</tr>
				</thead>
				<tbody>${rows}</tbody>
			</table>
		`;
	}

	function exportBulkCsv(items) {
		if (!items || !items.length) return;
		let csv = 'Domain,TrustFlow,CitationFlow,RefDomains,Backlinks\n';
		items.forEach((item) => {
			csv += `"${item.Item || ''}","${item.TrustFlow ?? 0}","${item.CitationFlow ?? 0}","${item.RefDomains ?? 0}","${item.ExtBackLinks ?? 0}"\n`;
		});

		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'linking_bulk_v2.csv';
		link.click();
		URL.revokeObjectURL(url);
	}

	globalThis.LinkingRendererV2 = Object.freeze({
		renderSingle,
		renderBulk,
		exportBulkCsv,
		renderPlaceholder,
		renderError,
		renderLoading
	});
})();
