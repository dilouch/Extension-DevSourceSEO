/**
 * @fileoverview Module background qui intercepte les réponses HTTP pour stocker
 * les informations réseau (IP, CDN, serveur, cache) de chaque page visitée.
 * Plafonné à 150 entrées pour éviter une croissance infinie du storage.
 * Exposé sur `globalThis.NetworkInfoV2`.
 * @module network-info
 */

(() => {
    /** @const {string} Clé de stockage dans `chrome.storage.local` */
    const STORAGE_KEY = 'networkInfoV2';

    /** @const {number} Nombre maximum d'URLs conservées dans le storage */
    const MAX_URL_ENTRIES = 150;

    /**
     * Convertit le tableau de headers HTTP (format `[{name, value}]`) en objet clé/valeur.
     * Les clés sont normalisées en minuscules pour des comparaisons insensibles à la casse.
     * @param {Array<{name: string, value: string}>} [headers=[]] - Les headers de la réponse HTTP
     * @returns {Object.<string, string>} Un objet `{ 'content-type': 'text/html', ... }`
     */
    const normalizeHeaders = (headers = []) => {
        const out = {};
        headers.forEach((header) => {
            const key = String(header?.name || '').toLowerCase();
            if (!key) return;
            out[key] = String(header?.value || '');
        });
        return out;
    };

    /**
     * Détecte le CDN utilisé à partir des headers de réponse HTTP.
     * Vérifie les headers spécifiques à Cloudflare, Fastly, CloudFront et Akamai.
     * Retourne le contenu du header `server` en dernier recours.
     * @param {Object.<string, string>} headers - Les headers normalisés en minuscules
     * @returns {string} Le nom du CDN détecté, ou la valeur du header `server`, ou une chaîne vide
     */
    const detectCdn = (headers) => {
        if (headers['cf-ray'] || headers['cf-cache-status']) return 'Cloudflare';
        if (headers['x-served-by'] || headers['x-cache-hits']) return 'Fastly';
        if (headers['x-amz-cf-id'] || headers['x-amz-cf-pop']) return 'CloudFront';
        if (headers['x-akamai-transformed'] || /akamai/i.test(headers.server || '')) return 'Akamai';
        if (/cloudfront/i.test(headers.via || headers.server || '')) return 'CloudFront';
        return headers.server ? String(headers.server) : '';
    };

    /**
     * Supprime les entrées URL les plus anciennes si le store dépasse `MAX_URL_ENTRIES`.
     * Les clés de type `tab:xxx` ne sont pas comptées dans la limite et ne sont jamais supprimées ici.
     * @param {Object} store - L'objet complet du storage réseau
     * @returns {Object} Le store modifié (mutation en place)
     */
    const pruneIfNeeded = (store) => {
        const urlKeys = Object.keys(store).filter((k) => !k.startsWith('tab:'));
        if (urlKeys.length <= MAX_URL_ENTRIES) return store;
        urlKeys.sort((a, b) => (store[a]?.date || 0) - (store[b]?.date || 0));
        const toDelete = urlKeys.slice(0, urlKeys.length - MAX_URL_ENTRIES);
        toDelete.forEach((k) => { delete store[k]; });
        return store;
    };

    /**
     * Intercepte une réponse HTTP et enregistre ses informations réseau dans le storage.
     * Ignore les requêtes qui ne sont pas de type `main_frame` (iframes, scripts, images, etc.)
     * ainsi que celles qui ne proviennent pas du frame principal (`frameId !== 0`).
     * Indexe les données par URL et par `tab:tabId` pour permettre deux stratégies de lookup.
     * @param {Object} details - L'objet de détails fourni par `chrome.webRequest.onResponseStarted`
     * @returns {Promise<void>}
     */
    async function update(details) {
        if (details.type && details.type !== 'main_frame') return;
        if (details.frameId !== 0) return;

        const headers = normalizeHeaders(details.responseHeaders || []);
        const info = {
            url: details.url,
            tabId: details.tabId,
            server: headers.server || '',
            cdn: detectCdn(headers),
            cache: headers['x-cache'] || headers['cache-control'] || '',
            ip: details.ip || headers['x-forwarded-for'] || headers['x-real-ip'] || '',
            date: Date.now()
        };

        await new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEY], (result) => {
                let current = result?.[STORAGE_KEY] && typeof result[STORAGE_KEY] === 'object'
                    ? result[STORAGE_KEY] : {};
                current[details.url] = info;
                if (typeof details.tabId === 'number' && details.tabId >= 0) {
                    current['tab:' + details.tabId] = info;
                }
                current = pruneIfNeeded(current);
                chrome.storage.local.set({ [STORAGE_KEY]: current }, resolve);
            });
        });
    }

    /**
     * Récupère les informations réseau pour une URL ou un tabId donné.
     * Applique quatre stratégies de fallback dans l'ordre :
     * 1. Correspondance exacte par URL
     * 2. Correspondance par `tab:tabId`
     * 3. Correspondance par URL normalisée (sans slash final, en minuscules)
     * 4. Correspondance par hostname (entrée la plus récente)
     * @param {string} url - L'URL de la page dont on veut les infos réseau
     * @param {number} [tabId] - L'identifiant de l'onglet Chrome (optionnel)
     * @returns {Promise<{ url: string, ip: string, cdn: string, server: string, cache: string }>}
     */
    async function get(url, tabId) {
        return new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEY], (result) => {
                const store = result?.[STORAGE_KEY] && typeof result[STORAGE_KEY] === 'object'
                    ? result[STORAGE_KEY] : {};

                if (store[url]) return resolve(store[url]);
                if (typeof tabId === 'number' && store['tab:' + tabId]) return resolve(store['tab:' + tabId]);

                try {
                    const target = new URL(url);
                    const norm = (u) => {
                        try {
                            const x = new URL(u);
                            return (x.origin + x.pathname.replace(/\/$/, '')).toLowerCase();
                        } catch (_) { return ''; }
                    };
                    const wanted = norm(url);
                    for (const key of Object.keys(store)) {
                        if (key.startsWith('tab:')) continue;
                        if (norm(key) === wanted) return resolve(store[key]);
                    }
                    let best = null;
                    for (const key of Object.keys(store)) {
                        if (key.startsWith('tab:')) continue;
                        try {
                            if (new URL(key).hostname === target.hostname) {
                                const entry = store[key];
                                if (!best || (entry?.date || 0) > (best?.date || 0)) best = entry;
                            }
                        } catch (_) {}
                    }
                    if (best) return resolve(best);
                } catch (_) {}

                resolve({ url, ip: '', cdn: '', server: '', cache: '' });
            });
        });
    }

    globalThis.NetworkInfoV2 = Object.freeze({ update, get });
})();
