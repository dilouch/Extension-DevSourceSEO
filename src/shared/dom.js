(() => {
	function escapeHtml(value) {
		return String(value ?? '').replace(/[&<>"']/g, (char) => ({
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;'
		}[char]));
	}

	function countByStatus(items, status) {
		if (!Array.isArray(items)) {
			return 0;
		}
		return items.filter((item) => item?.status === status).length;
	}

	globalThis.DomV2 = Object.freeze({
		escapeHtml,
		countByStatus
	});
})();
