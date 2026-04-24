(() => {
	const esc = (value) => globalThis.DomV2?.escapeHtml
		? globalThis.DomV2.escapeHtml(value)
		: String(value ?? '');

	const render = (container, networkInfo = {}, history = []) => {
		if (!container) return;
		const rows = Array.isArray(history) && history.length
			? history.map((entry) => `
				<li class="redirect-item">
					<span class="redirect-status">${esc(entry.status || '')}</span>
					<span class="redirect-url">${esc(entry.url || '')}</span>
					<span class="redirect-date">${esc(entry.date || '')}</span>
				</li>
			`).join('')
			: '<li class="redirect-empty">Aucun historique détecté.</li>';

		container.innerHTML = `
			<div class="mini-kpi-grid">
				<div class="mini-kpi"><span class="mini-kpi-label">Serveur</span><span class="mini-kpi-value">${esc(networkInfo.server || '-')}</span></div>
				<div class="mini-kpi"><span class="mini-kpi-label">CDN</span><span class="mini-kpi-value">${esc(networkInfo.cdn || '-')}</span></div>
				<div class="mini-kpi"><span class="mini-kpi-label">Cache</span><span class="mini-kpi-value">${esc(networkInfo.cache || '-')}</span></div>
			</div>
			<ul class="redirect-list">${rows}</ul>
		`;
	};

	globalThis.RedirectsModuleV2 = Object.freeze({
		render
	});
})();
