// Stocke et récupère les infos réseau (IP, CDN, serveur) de chaque page visitée.
// Plafonné à MAX_URL_ENTRIES entrées pour éviter une croissance infinie du storage.
(() => {
    const STORAGE_KEY = 'networkInfoV2';
    const MAX_URL_ENTRIES = 150;

    // Convertit le tableau de headers en objet clé/valeur en minuscules
    const normalizeHeaders = (headers = []) => {
        const out = {};
        headers.forEach((header) => {
            const key = String(header?.name || '').toLowerCase();
            if (!key) return;
            out[key] = String(header?.value || '');
        });
        return out;
    };

    // Détecte le CDN utilisé à partir des headers de réponse
    const detectCdn = (headers) => {
        if (headers['cf-ray'] || headers['cf-cache-status']) return 'Cloudflare';
        if (headers['x-served-by'] || headers['x-cache-hits']) return 'Fastly';
        if (headers['x-amz-cf-id'] || headers['x-amz-cf-pop']) return 'CloudFront';
        if (headers['x-akamai-transformed'] || /akamai/i.test(headers.server || '')) return 'Akamai';
        if (/cloudfront/i.test(headers.via || headers.server || '')) return 'CloudFront';
        return headers.server ? String(headers.server) : '';
    };

    // Supprime les entrées les plus anciennes si on dépasse MAX_URL_ENTRIES
    const pruneIfNeeded = (store) => {
        const urlKeys = Object.keys(store).filter((k) => !k.startsWith('tab:'));
        if (urlKeys.length <= MAX_URL_ENTRIES) return store;
        urlKeys.sort((a, b) => (store[a]?.date || 0) - (store[b]?.date || 0));
        const toDelete = urlKeys.slice(0, urlKeys.length - MAX_URL_ENTRIES);
        toDelete.forEach((k) => { delete store[k]; });
        return store;
    };

    // Enregistre les infos réseau d'une requête main_frame dans le storage
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

    // Récupère les infos réseau pour une URL ou un tabId donné
    // Essaie plusieurs stratégies : URL exacte → tabId → URL normalisée → même hôte
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
