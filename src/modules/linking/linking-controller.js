(() => {
	const STORAGE_KEY_API = 'seobserverApiKeyV2';
	const STORAGE_KEY_CACHE_PREFIX = 'linking_cache_';
	const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

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
			globalThis.LinkingRendererV2?.renderError(refs.singleResult, 'Domaine introuvable sur cet onglet.');
			return;
		}
		if (!key) {
			status('Linking: clé API manquante.');
			globalThis.LinkingRendererV2?.renderError(refs.singleResult, 'Clé API SEObserver manquante.');
			return;
		}

		chrome.storage.local.set({ [STORAGE_KEY_API]: key });

		const cacheKey = getCacheKey(domain);
		if (!force) {
			const cached = await new Promise((resolve) => chrome.storage.local.get([cacheKey], resolve));
			const entry = cached?.[cacheKey];
			if (entry?.item && entry.checkedAt && (Date.now() - entry.checkedAt) < CACHE_TTL_MS) {
				globalThis.LinkingRendererV2?.renderSingle(refs.singleResult, entry.item, entry.checkedAt);
				status('Linking: résultat chargé depuis le cache (< 24h).');
				return;
			}
		}

		try {
			globalThis.LinkingRendererV2?.renderLoading(refs.singleResult, `Analyse de ${domain}...`);
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
			globalThis.LinkingRendererV2?.renderError(refs.singleResult, `Erreur API: ${error.message}`);
		}
	}

	async function runBulk() {
		const key = getApiKey();
		if (!key) {
			status('Linking: clé API manquante.');
			globalThis.LinkingRendererV2?.renderError(refs.bulkResult, 'Clé API SEObserver manquante.');
			return;
		}

		const raw = String(refs.bulkInput?.value || '').trim();
		if (!raw) {
			status('Linking: ajoute des domaines/URLs pour le bulk.');
			globalThis.LinkingRendererV2?.renderPlaceholder(refs.bulkResult, 'Saisis un ou plusieurs domaines (un par ligne) puis lance le bulk.');
			return;
		}

		const domains = raw
			.split(/[\n,;]+/)
			.map((entry) => globalThis.LinkingApiV2.normalizeDomain(entry))
			.filter(Boolean);

		if (!domains.length) {
			status('Linking: aucun domaine valide détecté.');
			globalThis.LinkingRendererV2?.renderError(refs.bulkResult, 'Aucun domaine valide détecté.');
			return;
		}

		try {
			status(`Linking: bulk en cours (${domains.length} domaines)...`);
			globalThis.LinkingRendererV2?.renderLoading(refs.bulkResult, `Bulk en cours sur ${domains.length} domaines...`);
			bulkData = await globalThis.LinkingApiV2.fetchMetrics(domains, key);
			globalThis.LinkingRendererV2?.renderBulk(refs.bulkResult, bulkData);
			status(`Linking: bulk terminé (${bulkData.length}/${domains.length} résultats).`);
		} catch (error) {
			status(`Linking bulk: ${error.message}`);
			globalThis.LinkingRendererV2?.renderError(refs.bulkResult, `Erreur API bulk: ${error.message}`);
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
		globalThis.LinkingRendererV2.renderPlaceholder(refs.singleResult, 'Renseigne ta clé API puis clique sur « Analyser domaine ».');
		globalThis.LinkingRendererV2.renderPlaceholder(refs.bulkResult, 'Saisis des domaines (un par ligne) et lance le bulk.');
		initialized = true;
	}

	globalThis.LinkingControllerV2 = Object.freeze({
		init,
		runPage,
		runBulk
	});
})();
