(() => {
	function normalizeDomain(input) {
		const value = String(input || '').trim();
		if (!value) return '';

		try {
			const url = new URL(value.startsWith('http') ? value : `https://${value}`);
			return url.hostname.replace(/^www\./i, '').toLowerCase();
		} catch (_err) {
			return value.replace(/^www\./i, '').toLowerCase();
		}
	}

	async function fetchMetrics(domains, apiKey) {
		const cleanDomains = (domains || []).map(normalizeDomain).filter(Boolean);
		if (!cleanDomains.length) {
			return [];
		}

		const response = await fetch('https://api1.seobserver.com/backlinks/metrics.json', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-SEObserver-key': String(apiKey || '').trim()
			},
			body: JSON.stringify(cleanDomains.map((domain) => ({
				item_type: 'domain',
				item_value: domain
			})))
		});

		if (!response.ok) {
			throw new Error(`API HTTP ${response.status}`);
		}

		const json = await response.json();
		return Array.isArray(json?.data) ? json.data : [];
	}

	globalThis.LinkingApiV2 = Object.freeze({
		normalizeDomain,
		fetchMetrics
	});
})();
