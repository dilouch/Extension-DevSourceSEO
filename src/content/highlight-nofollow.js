(() => {
	if (window.__nofollowHighlightLoaded) return;
	window.__nofollowHighlightLoaded = true;

	const STORAGE_KEY = 'v2.advanced.settings';
	let enabled = false;
	let highlighted = [];

	const clear = () => {
		highlighted.forEach((link) => {
			link.style.outline = '';
			link.style.outlineOffset = '';
			link.removeAttribute('data-devsource-nofollow');
		});
		highlighted = [];
	};

	const apply = () => {
		clear();
		if (!enabled) return;
		const links = Array.from(document.querySelectorAll('a[rel~="nofollow"], a[rel~="sponsored"], a[rel~="ugc"]'));
		links.forEach((link) => {
			link.style.outline = '2px solid #f1fd0d';
			link.style.outlineOffset = '2px';
			link.setAttribute('data-devsource-nofollow', 'true');
		});
		highlighted = links;
	};

	const computeEnabled = (settings) => {
		const globalEnabled = settings?.highlightNofollow !== false; // défaut: true
		if (!globalEnabled) return false;
		const exclusions = Array.isArray(settings?.nofollowExclusions) ? settings.nofollowExclusions : [];
		const host = window.location.hostname;
		return !exclusions.includes(host);
	};

	const loadAndApply = () => {
		try {
			chrome.storage.local.get([STORAGE_KEY], (result) => {
				const settings = result?.[STORAGE_KEY] || {};
				enabled = computeEnabled(settings);
				apply();
			});
		} catch (_) { /* hors contexte extension */ }
	};

	loadAndApply();

	// Réagir aux changements de storage (toggle depuis le popup)
	try {
		chrome.storage.onChanged.addListener((changes, area) => {
			if (area !== 'local' || !changes[STORAGE_KEY]) return;
			const settings = changes[STORAGE_KEY].newValue || {};
			enabled = computeEnabled(settings);
			apply();
		});
	} catch (_) { /* hors contexte extension */ }

	chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		if (message?.type === 'SET_NOFOLLOW_HIGHLIGHT') {
			enabled = Boolean(message.enabled);
			apply();
			sendResponse({ success: true, enabled });
			return true;
		}
		if (message?.type === 'REFRESH_NOFOLLOW') {
			loadAndApply();
			sendResponse({ success: true });
			return true;
		}
		return false;
	});
})();
