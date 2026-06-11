/**
 * @fileoverview Module background qui conserve un historique des dernières redirections HTTP détectées.
 * Limité à 10 entrées pour rester léger.
 * Exposé sur `globalThis.RedirectHistoryV2`.
 * @module redirect-history
 */

(() => {
	/** @const {string} Clé de stockage dans `chrome.storage.local` */
	const STORAGE_KEY = 'redirectHistory';

	/** @const {number} Nombre maximum d'entrées conservées */
	const MAX_ENTRIES = 10;

	/**
	 * Retourne l'historique complet des redirections depuis le storage.
	 * @returns {Promise<Array<{ url: string, status: number, method: string, date: string }>>}
	 */
	async function get() {
		return new Promise((resolve) => {
			chrome.storage.local.get([STORAGE_KEY], (result) => {
				resolve(Array.isArray(result?.[STORAGE_KEY]) ? result[STORAGE_KEY] : []);
			});
		});
	}

	/**
	 * Ajoute une redirection en tête de l'historique et tronque à `MAX_ENTRIES`.
	 * @param {{ url: string, statusCode: number, method: string }} details - Les détails de la requête HTTP
	 * @returns {Promise<void>}
	 */
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