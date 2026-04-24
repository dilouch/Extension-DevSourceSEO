(() => {
	const STORAGE_KEY = 'redirectHistory';
	const MAX_ENTRIES = 20;

	async function get() {
		return new Promise((resolve) => {
			chrome.storage.local.get([STORAGE_KEY], (result) => {
				resolve(Array.isArray(result?.[STORAGE_KEY]) ? result[STORAGE_KEY] : []);
			});
		});
	}

	async function push(details) {
		const history = await get();
		history.unshift({
			url: details.url,
			status: details.statusCode,
			method: details.method,
			date: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
		});
		await new Promise((resolve) => {
			chrome.storage.local.set({ [STORAGE_KEY]: history.slice(0, MAX_ENTRIES) }, resolve);
		});
	}

	globalThis.RedirectHistoryV2 = Object.freeze({
		get,
		push
	});
})();