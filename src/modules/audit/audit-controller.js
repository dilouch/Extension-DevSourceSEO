(() => {
	const analyze = (pageData) => globalThis.AuditEngineV2?.runAudit(pageData);

	const render = (container, pageData) => {
		const result = analyze(pageData);
		globalThis.AuditRendererV2?.render(container, result);
		return result;
	};

	globalThis.AuditControllerV2 = Object.freeze({
		analyze,
		render
	});
})();