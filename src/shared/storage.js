(() => {
	const get = (keys) => new Promise((resolve) => {
		chrome.storage.local.get(keys, (result) => resolve(result || {}));
	});

	const set = (value) => new Promise((resolve) => {
		chrome.storage.local.set(value, resolve);
	});

	const remove = (keys) => new Promise((resolve) => {
		chrome.storage.local.remove(keys, resolve);
	});

	const pushListItem = async (key, item, limit = 50) => {
		const result = await get([key]);
		const list = Array.isArray(result[key]) ? result[key] : [];
		list.unshift(item);
		await set({ [key]: list.slice(0, limit) });
		return list.slice(0, limit);
	};

	globalThis.StorageV2 = Object.freeze({
		get,
		set,
		remove,
		pushListItem
	});
})();
