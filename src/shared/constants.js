(() => {
	const STORAGE_KEYS = Object.freeze({
		SAVES: 'v2.savedAnalyses',
		SETTINGS: 'v2.settings',
		SEOBSERVER_API_KEY: 'seobserverApiKeyV2',
		REDIRECT_HISTORY: 'redirectHistory',
		NETWORK_INFO: 'networkInfoV2'
	});

	const TAB_DEFINITIONS = Object.freeze([
		{ id: 'tab-overview', label: 'Apercu' },
		{ id: 'tab-audit', label: 'Audit' },
		{ id: 'tab-meta', label: 'Meta' },
		{ id: 'tab-headings', label: 'Titres' },
		{ id: 'tab-links', label: 'Liens' },
		{ id: 'tab-images', label: 'Images' },
		{ id: 'tab-colors', label: 'Couleurs' },
		{ id: 'tab-structured-data', label: 'Schema' },
		{ id: 'tab-linking', label: 'Linking' },
		{ id: 'tab-capture', label: 'Capture' },
		{ id: 'tab-save', label: 'Sauvegarde' },
		{ id: 'tab-brand', label: 'Brand' },
		{ id: 'tab-responsive', label: 'Resp.' },
		{ id: 'tab-network', label: 'Redir.' },
		{ id: 'tab-favicon', label: 'Favicon' }
	]);

	const DEFAULT_DEVICES = Object.freeze([
		{ label: 'iPhone 15', width: 393, height: 852 },
		{ label: 'Pixel 8', width: 412, height: 915 },
		{ label: 'iPad', width: 820, height: 1180 },
		{ label: 'MacBook', width: 1440, height: 900 },
		{ label: 'Desktop', width: 1920, height: 1080 }
	]);

	globalThis.DevsourceConstantsV2 = Object.freeze({
		STORAGE_KEYS,
		TAB_DEFINITIONS,
		DEFAULT_DEVICES,
		MAX_SAVES: 50
	});
})();
