(() => {
	const BRAND_COLORS = [
		{ label: 'Dark Slate', value: '#283A3B' },
		{ label: 'White', value: '#FFFFFF' },
		{ label: 'Black', value: '#000000' },
		{ label: 'Dark Green', value: '#12272B' },
		{ label: 'Deep Teal', value: '#1A3638' },
		{ label: 'Neon Yellow', value: '#F1FD0D' },
		{ label: 'Soft Light', value: '#F0F3F1' }
	];

	const TYPOGRAPHY = [
		{ label: 'Titre', value: 'DM Sans, system-ui, sans-serif' },
		{ label: 'Texte', value: 'Inter, system-ui, sans-serif' },
		{ label: 'Mono', value: 'ui-monospace, SFMono-Regular, monospace' }
	];

	const resolvePalette = () => BRAND_COLORS;

	const render = (container, data, options = {}) => {
		if (!container) return;
		const palette = resolvePalette(data);

		const colors = palette.map((item) => `
			<button type="button" class="brand-board-card" data-copy="${item.value}">
				<span class="brand-board-swatch" style="background:${item.value}"></span>
				<span class="brand-board-meta">
					<strong class="brand-board-hex">${item.value}</strong>
					<span class="brand-board-name">${item.label}</span>
				</span>
			</button>
		`).join('');

		const fonts = TYPOGRAPHY.map((item) => `
			<div class="brand-font-card">
				<div class="brand-font-label">${item.label}</div>
				<div class="brand-font-value">${item.value}</div>
			</div>
		`).join('');

		container.innerHTML = `
			<div class="brand-board">
				<div class="brand-board-top">
					<h3 class="brand-board-title">Brand Board Devsource</h3>
				</div>
				<div class="brand-board-divider"></div>
				<div class="brand-block">
					<h4>Palette de couleurs</h4>
					<div id="brand-copy-feedback" class="brand-copy-feedback" aria-live="polite"></div>
					<div class="brand-board-grid">${colors}</div>
				</div>
			</div>
			<div class="brand-block">
				<h4>Typographie</h4>
				<div class="brand-font-grid">${fonts}</div>
			</div>
		`;

		const feedbackEl = container.querySelector('#brand-copy-feedback');
		let feedbackTimer = null;

		const showFeedback = (text, kind = 'ok') => {
			if (!feedbackEl) return;
			feedbackEl.textContent = text;
			feedbackEl.classList.remove('is-hidden', 'is-error');
			if (kind === 'error') {
				feedbackEl.classList.add('is-error');
			}
			if (feedbackTimer) clearTimeout(feedbackTimer);
			feedbackTimer = setTimeout(() => {
				feedbackEl.classList.add('is-hidden');
			}, 1200);
		};

		Array.from(container.querySelectorAll('[data-copy]')).forEach((button) => {
			button.addEventListener('click', async () => {
				const value = button.getAttribute('data-copy') || '';
				try {
					await globalThis.UtilsV2.copyText(value);
					showFeedback(`Couleur copié: ${value}`);
					button.classList.add('copied');
					setTimeout(() => button.classList.remove('copied'), 650);
				} catch (_err) {
					showFeedback('Copie impossible', 'error');
					button.classList.add('copy-error');
					setTimeout(() => button.classList.remove('copy-error'), 650);
				}
			});
		});

		container.querySelector('#brand-board-print')?.addEventListener('click', () => {
			if (typeof options.onPrintPdf === 'function') {
				options.onPrintPdf();
			}
		});
	};

	globalThis.BrandModuleV2 = Object.freeze({
		render
	});
})();
