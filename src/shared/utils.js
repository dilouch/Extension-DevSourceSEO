(() => {
	const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	}[char]));

	const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

	const toNumber = (value, fallback = 0) => {
		const number = Number(value);
		return Number.isFinite(number) ? number : fallback;
	};

	const formatDateTime = (value) => {
		if (!value) return '-';
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return '-';
		return new Intl.DateTimeFormat('fr-FR', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	};

	const normalizeDomain = (input) => {
		const value = String(input || '').trim();
		if (!value) return '';
		try {
			const url = new URL(value.startsWith('http') ? value : `https://${value}`);
			return url.hostname.replace(/^www\./i, '').toLowerCase();
		} catch (_err) {
			return value.replace(/^www\./i, '').toLowerCase();
		}
	};

	const rgbToHex = (color) => {
		const value = String(color || '').trim();
		const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
		if (!match) return value.toUpperCase();
		const toHex = (n) => Number(n).toString(16).padStart(2, '0');
		return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`.toUpperCase();
	};

	const pickText = (value, fallback = '-') => {
		const text = String(value ?? '').trim();
		return text || fallback;
	};

	const unique = (items) => Array.from(new Set((items || []).filter(Boolean)));

	const downloadBlob = (blob, filename) => {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	};

	const copyText = async (text) => {
		await navigator.clipboard.writeText(String(text ?? ''));
	};

	globalThis.UtilsV2 = Object.freeze({
		escapeHtml,
		clamp,
		toNumber,
		formatDateTime,
		normalizeDomain,
		rgbToHex,
		pickText,
		unique,
		downloadBlob,
		copyText
	});
})();
