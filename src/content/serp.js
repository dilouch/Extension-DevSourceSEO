(() => {
	if (window.__serpBadgeLoaded) return;
	window.__serpBadgeLoaded = true;

	const badgeClass = 'devsource-serp-badge';
	const style = document.createElement('style');
	style.textContent = `
		.${badgeClass}{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;margin-right:6px;border-radius:999px;background:#12272b;color:#fff;font-size:11px;font-weight:700;vertical-align:middle}
	`;
	document.documentElement.appendChild(style);

	const normalizeHref = (href) => {
		if (!href) return '';
		try {
			const url = new URL(href, location.href);
			url.hash = '';
			return url.toString();
		} catch (_err) {
			return String(href);
		}
	};

	const shouldSkipResultNode = (node) => {
		if (!node) return true;
		if (node.closest('[data-text-ad]')) return true;
		if (node.closest('.commercial-unit-desktop-rhs')) return true;
		if (node.closest('.uEierd')) return true;
		if (node.querySelector('.rllt__details, [data-local-attribute], .local-pack')) return true;

		const text = (node.textContent || '').toLowerCase();
		if (!text) return true;
		if (text.includes('people also ask')) return true;
		if (text.includes('autres questions posees')) return true;
		if (text.includes('related searches')) return true;
		if (text.includes('recherches associees')) return true;
		if (text.includes('sponsored')) return true;
		if (text.includes('annonce')) return true;

		return false;
	};

	const getOrganicResults = () => {
		const selectors = [
			'#search .MjjYud',
			'#rso .g',
			'#rso > div[data-snc]',
			'#rso > div'
		];
		const nodes = Array.from(document.querySelectorAll(selectors.join(',')));
		const seenNode = new Set();
		const seenHref = new Set();
		const results = [];

		nodes.forEach((node) => {
			if (!node || seenNode.has(node) || shouldSkipResultNode(node)) return;
			seenNode.add(node);

			const h3 = node.querySelector('h3');
			const link = h3?.closest('a') || node.querySelector('a h3')?.closest('a') || node.querySelector('a[href]');
			if (!h3 || !link) return;

			const href = normalizeHref(link.getAttribute('href') || link.href);
			if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
			if (seenHref.has(href)) return;
			seenHref.add(href);

			results.push({
				node,
				title: h3
			});
		});

		return results;
	};

	const apply = () => {
		document.querySelectorAll(`.${badgeClass}`).forEach((badge) => badge.remove());

		const start = Number.parseInt(new URLSearchParams(location.search).get('start') || '0', 10) || 0;
		const results = getOrganicResults();
		results.forEach((result, index) => {
			const badge = document.createElement('span');
			badge.className = badgeClass;
			badge.textContent = String(start + index + 1);
			result.title.prepend(badge);
		});
	};

	apply();
	new MutationObserver(apply).observe(document.body || document.documentElement, {
		childList: true,
		subtree: true
	});
})();
