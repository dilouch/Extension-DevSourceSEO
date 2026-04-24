(() => {
	const esc = (value) => globalThis.DomV2?.escapeHtml
		? globalThis.DomV2.escapeHtml(value)
		: String(value ?? '');

	function renderSingle(container, item, checkedAt) {
		if (!container) return;
		if (!item) {
			container.innerHTML = '<p class="linking-empty">Aucune donnée Linking.</p>';
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
		exportBulkCsv
	});
})();
