(() => {
	const esc = (value) => globalThis.DomV2?.escapeHtml
		? globalThis.DomV2.escapeHtml(value)
		: String(value ?? '');

	const render = (container, result) => {
		if (!container) return;
		if (!result) {
			container.innerHTML = '<div class="hint">Aucun audit disponible.</div>';
			return;
		}

		const rows = result.items.map((item) => `
			<li class="audit-item audit-${esc(item.status)}">
				<div class="audit-item-head">
					<span class="audit-item-label">${esc(item.label)}</span>
					<span class="audit-item-status">${esc(item.status)}</span>
				</div>
				<div class="audit-item-message">${esc(item.message)}</div>
			</li>
		`).join('');

		container.innerHTML = `
			<div class="audit-score-card">
				<div class="audit-score-value">${result.score}</div>
				<div class="audit-score-label">Score SEO</div>
				<div class="audit-score-stats">OK ${result.stats.ok} • Warn ${result.stats.warning} • Err ${result.stats.error}</div>
			</div>
			<ul class="audit-list">${rows}</ul>
		`;
	};

	globalThis.AuditRendererV2 = Object.freeze({
		render
	});
})();