(() => {
	const esc = (value) => globalThis.DomV2?.escapeHtml
		? globalThis.DomV2.escapeHtml(value)
		: String(value ?? '');

	const SIZES = [16, 32, 64, 128, 256, 512];
	const FORMATS = ['png', 'jpg', 'webp'];

	const getMimeType = (format) => {
		if (format === 'jpg') return 'image/jpeg';
		if (format === 'webp') return 'image/webp';
		return 'image/png';
	};

	const getDomain = (url) => {
		try {
			return new URL(url).hostname;
		} catch (_err) {
			return '';
		}
	};

	const loadImage = (src) => new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('Image favicon introuvable.'));
		img.src = src;
	});

	const buildSizeButtons = (activeSize) => SIZES.map((size) => `
		<button type="button" class="fav-tool-btn ${size === activeSize ? 'active' : ''}" data-size="${size}">${size}</button>
	`).join('');

	const buildFormatButtons = (activeFormat) => FORMATS.map((format) => `
		<button type="button" class="fav-tool-btn fav-format-btn ${format === activeFormat ? 'active' : ''}" data-format="${format}">${format.toUpperCase()}</button>
	`).join('');

	const render = (container, data = {}) => {
		if (!container) return;
		const favicon = String(data.favicon || '').trim();
		const fallback = data.url ? `https://www.google.com/s2/favicons?sz=256&domain_url=${encodeURIComponent(data.url)}` : '';
		const image = favicon || fallback;
		const domain = getDomain(data.url || '');

		const state = {
			size: 256,
			format: 'png',
			source: image,
			naturalWidth: 0,
			naturalHeight: 0
		};

		container.innerHTML = `
			<div class="fav-tool-card">
				<div class="fav-tool-preview-wrap">
					<div class="fav-tool-preview" id="fav-tool-preview">
						<img id="fav-tool-img" src="${esc(image)}" alt="favicon">
					</div>
				</div>
				<div class="fav-tool-meta-row">
					<div class="fav-tool-domain"><strong>Domaine:</strong> ${esc(domain || 'N/A')}</div>
					<div class="fav-tool-dim" id="fav-tool-dim">-</div>
				</div>
				<div class="fav-tool-row">
					<div class="fav-tool-label">Taille</div>
					<div class="fav-tool-controls" id="fav-tool-sizes">${buildSizeButtons(state.size)}</div>
				</div>
				<div class="fav-tool-row">
					<div class="fav-tool-label">Format</div>
					<div class="fav-tool-controls" id="fav-tool-formats">${buildFormatButtons(state.format)}</div>
				</div>
				<div class="fav-tool-row">
					<div class="fav-tool-label">Outils</div>
					<div class="fav-tool-controls fav-tool-actions">
						<button type="button" id="fav-copy-link" class="btn btn-secondary">📋 Copier Lien</button>
						<button type="button" id="fav-copy-b64" class="btn btn-secondary">📋 Copier Base64</button>
					</div>
				</div>
				<div id="fav-tool-feedback" class="fav-tool-feedback" aria-live="polite"></div>
				<div class="favicon-meta">
					<div class="favicon-url">${esc(favicon || image || 'Favicon non détecté')}</div>
					<div class="hint">${favicon ? 'Icône détectée sur la page.' : 'Fallback favicon utilisé.'}</div>
				</div>
			</div>
		`;

		const imgEl = container.querySelector('#fav-tool-img');
		const dimEl = container.querySelector('#fav-tool-dim');
		const sizesEl = container.querySelector('#fav-tool-sizes');
		const formatsEl = container.querySelector('#fav-tool-formats');
		const feedbackEl = container.querySelector('#fav-tool-feedback');

		const setFeedback = (text, isError = false) => {
			if (!feedbackEl) return;
			feedbackEl.textContent = text;
			feedbackEl.classList.toggle('is-error', Boolean(isError));
		};

		const updateDimensionLabel = () => {
			if (!dimEl) return;
			if (!state.naturalWidth || !state.naturalHeight) {
				dimEl.textContent = '-';
				return;
			}
			dimEl.textContent = `${state.naturalWidth} x ${state.naturalHeight} px`;
		};

		const updateControls = () => {
			if (sizesEl) sizesEl.innerHTML = buildSizeButtons(state.size);
			if (formatsEl) formatsEl.innerHTML = buildFormatButtons(state.format);
		};

		const getProcessedDataUrl = async () => {
			if (!state.source) return '';
			try {
				const loaded = await loadImage(state.source);
				state.naturalWidth = loaded.naturalWidth || loaded.width || 0;
				state.naturalHeight = loaded.naturalHeight || loaded.height || 0;
				updateDimensionLabel();

				const canvas = document.createElement('canvas');
				canvas.width = state.size;
				canvas.height = state.size;
				const ctx = canvas.getContext('2d');
				ctx.clearRect(0, 0, state.size, state.size);
				ctx.drawImage(loaded, 0, 0, state.size, state.size);
				return canvas.toDataURL(getMimeType(state.format), state.format === 'jpg' ? 0.92 : 1);
			} catch (_err) {
				return '';
			}
		};

		imgEl?.addEventListener('load', () => {
			state.naturalWidth = imgEl.naturalWidth || 0;
			state.naturalHeight = imgEl.naturalHeight || 0;
			updateDimensionLabel();
		});

		sizesEl?.addEventListener('click', (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			const size = Number(target.getAttribute('data-size'));
			if (!SIZES.includes(size)) return;
			state.size = size;
			updateControls();
			setFeedback(`Taille: ${size}px`);
		});

		formatsEl?.addEventListener('click', (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			const format = String(target.getAttribute('data-format') || '');
			if (!FORMATS.includes(format)) return;
			state.format = format;
			updateControls();
			setFeedback(`Format: ${format.toUpperCase()}`);
		});

		container.querySelector('#fav-copy-link')?.addEventListener('click', async () => {
			const processed = await getProcessedDataUrl();
			const value = processed || state.source;
			if (!value) {
				setFeedback('Aucun favicon à copier.', true);
				return;
			}
			try {
				await globalThis.UtilsV2.copyText(value);
				setFeedback('Lien favicon copié.');
			} catch (_err) {
				setFeedback('Copie impossible.', true);
			}
		});

		container.querySelector('#fav-copy-b64')?.addEventListener('click', async () => {
			const processed = await getProcessedDataUrl();
			if (!processed) {
				setFeedback('Base64 indisponible (CORS).', true);
				return;
			}
			const base64 = processed.split(',')[1] || '';
			if (!base64) {
				setFeedback('Base64 indisponible.', true);
				return;
			}
			try {
				await globalThis.UtilsV2.copyText(base64);
				setFeedback('Base64 copié.');
			} catch (_err) {
				setFeedback('Copie impossible.', true);
			}
		});

		updateDimensionLabel();
		updateControls();
	};

	globalThis.FaviconModuleV2 = Object.freeze({
		render
	});
})();
