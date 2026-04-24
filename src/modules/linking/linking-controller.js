(() => {
	const STORAGE_KEY_API = 'seobserverApiKeyV2';
	const STORAGE_KEY_CACHE_PREFIX = 'linking_cache_';

	let initialized = false;
	let bulkData = [];
	let setStatus = null;

	const refs = {
		apiKeyInput: null,
		runPageBtn: null,
		refreshPageBtn: null,
		singleResult: null,
		bulkInput: null,
		runBulkBtn: null,
		bulkResult: null,
		bulkExportCsvBtn: null
	};

	function status(text) {
		if (typeof setStatus === 'function') {
			setStatus(text);
		}
	}

	function getCacheKey(domain) {
		return `${STORAGE_KEY_CACHE_PREFIX}${domain}`;
	}

	function getApiKey() {
		return String(refs.apiKeyInput?.value || '').trim();
	}

	function getActiveDomain() {
		return new Promise((resolve) => {
			chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
				const tab = tabs?.[0];
				const domain = globalThis.LinkingApiV2?.normalizeDomain(tab?.url || '');
				resolve(domain || '');
			});
		});
	}

	async function runPage(force = false) {
		const domain = await getActiveDomain();
		const key = getApiKey();

		if (!domain) {
			status('Linking: domaine introuvable sur cet onglet.');
			return;
		}
		if (!key) {
			status('Linking: clé API manquante.');
			return;
		}

		chrome.storage.local.set({ [STORAGE_KEY_API]: key });

		const cacheKey = getCacheKey(domain);
		if (!force) {
			const cached = await new Promise((resolve) => chrome.storage.local.get([cacheKey], resolve));
			if (cached?.[cacheKey]?.item) {
				globalThis.LinkingRendererV2?.renderSingle(refs.singleResult, cached[cacheKey].item, cached[cacheKey].checkedAt);
				status('Linking: résultat chargé depuis le cache.');
				return;
			}
		}

		try {
			status('Linking: récupération API en cours...');
			const data = await globalThis.LinkingApiV2.fetchMetrics([domain], key);
			const item = data[0] || null;
			const checkedAt = Date.now();

			chrome.storage.local.set({
				[cacheKey]: { item, checkedAt }
			});

			globalThis.LinkingRendererV2?.renderSingle(refs.singleResult, item, checkedAt);
			status('Linking: analyse domaine terminée.');
		} catch (error) {
			status(`Linking API: ${error.message}`);
		}
	}

	async function runBulk() {
		const key = getApiKey();
		if (!key) {
			status('Linking: clé API manquante.');
			return;
		}

		const raw = String(refs.bulkInput?.value || '').trim();
		if (!raw) {
			status('Linking: ajoute des domaines/URLs pour le bulk.');
			return;
		}

		const domains = raw
			.split(/[\n,;]+/)
			.map((entry) => globalThis.LinkingApiV2.normalizeDomain(entry))
			.filter(Boolean);

		if (!domains.length) {
			status('Linking: aucun domaine valide détecté.');
			return;
		}

		try {
			status(`Linking: bulk en cours (${domains.length} domaines)...`);
			bulkData = await globalThis.LinkingApiV2.fetchMetrics(domains, key);
			globalThis.LinkingRendererV2?.renderBulk(refs.bulkResult, bulkData);
			status('Linking: bulk terminé.');
		} catch (error) {
			status(`Linking bulk: ${error.message}`);
		}
	}

	function bindDom() {
		refs.apiKeyInput = document.getElementById('seobserver-api-key');
		refs.runPageBtn = document.getElementById('btn-check-linking');
		refs.refreshPageBtn = document.getElementById('btn-refresh-linking');
		refs.singleResult = document.getElementById('linking-results');
		refs.bulkInput = document.getElementById('bulk-linking-input');
		refs.runBulkBtn = document.getElementById('btn-run-bulk-linking');
		refs.bulkResult = document.getElementById('bulk-linking-results');
		refs.bulkExportCsvBtn = document.getElementById('btn-bulk-csv');
	}

	function attachEvents() {
		refs.runPageBtn?.addEventListener('click', () => runPage(false));
		refs.refreshPageBtn?.addEventListener('click', () => runPage(true));
		refs.runBulkBtn?.addEventListener('click', runBulk);
		refs.bulkExportCsvBtn?.addEventListener('click', () => globalThis.LinkingRendererV2?.exportBulkCsv(bulkData));
	}

	function loadSavedApiKey() {
		chrome.storage.local.get([STORAGE_KEY_API], (result) => {
			if (refs.apiKeyInput && result?.[STORAGE_KEY_API]) {
				refs.apiKeyInput.value = result[STORAGE_KEY_API];
			}
		});
	}

	function init(options = {}) {
		if (initialized) return;
		if (!globalThis.LinkingApiV2 || !globalThis.LinkingRendererV2) return;

		setStatus = options.setStatus || null;
		bindDom();
		attachEvents();
		loadSavedApiKey();
		initialized = true;
	}

	globalThis.LinkingControllerV2 = Object.freeze({
		init,
		runPage,
		runBulk
	});
})();
