(() => {
	const BASE_PRESETS = globalThis.DevsourceConstantsV2?.DEFAULT_DEVICES || [];
	const SIMULATOR_PRESETS = [
		{ label: 'Mobile (Portrait)', width: 375, height: 667 },
		{ label: 'Mobile (Paysage)', width: 667, height: 375 },
		{ label: 'Tablette (Portrait)', width: 768, height: 1024 },
		{ label: 'Tablette (Paysage)', width: 1024, height: 768 },
		{ label: 'Desktop (Petit)', width: 1280, height: 800 },
		{ label: 'iPhone SE', width: 375, height: 667 },
		{ label: 'iPhone 12/13/14', width: 390, height: 844 },
		{ label: 'iPhone 13/14 Pro Max', width: 428, height: 926 },
		{ label: 'iPhone 15/15 Pro', width: 393, height: 852 },
		{ label: 'iPhone 15 Pro Max', width: 430, height: 932 },
		{ label: 'Samsung S20/S21', width: 360, height: 800 },
		{ label: 'Samsung S22 Ultra', width: 412, height: 915 },
		{ label: 'Google Pixel 7', width: 412, height: 915 },
		{ label: 'Samsung Galaxy Note 20', width: 412, height: 914 },
		{ label: 'Android Large', width: 414, height: 896 },
		{ label: 'iPad Mini', width: 768, height: 1024 },
		{ label: 'iPad Air', width: 820, height: 1180 },
		{ label: 'iPad Pro 12.9"', width: 1024, height: 1366 },
		{ label: 'Samsung Galaxy Tab', width: 800, height: 1280 },
		{ label: 'Surface Pro 7', width: 912, height: 1368 },
		{ label: 'Laptop (1366x768)', width: 1366, height: 768 },
		{ label: 'Laptop (1440x900)', width: 1440, height: 900 },
		{ label: 'MacBook Pro 14"', width: 1512, height: 982 },
		{ label: 'Desktop Full HD', width: 1920, height: 1080 },
		{ label: 'Desktop 2K (QHD)', width: 2560, height: 1440 },
		{ label: 'Desktop 4K (UHD)', width: 3840, height: 2160 }
	];

	const esc = (value) => globalThis.DomV2?.escapeHtml
		? globalThis.DomV2.escapeHtml(value)
		: String(value ?? '');

	const toCount = (value) => {
		const n = Number(value);
		return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
	};

	const normalizePresets = () => {
		const fromConstants = BASE_PRESETS
			.filter((item) => item && typeof item === 'object')
			.map((item) => ({
				label: String(item.label || '').trim(),
				width: toCount(item.width),
				height: toCount(item.height)
			}))
			.filter((item) => item.label && item.width && item.height);

		const merged = [...SIMULATOR_PRESETS, ...fromConstants];
		const unique = [];
		const seen = new Set();
		merged.forEach((item) => {
			const key = `${item.label}:${item.width}x${item.height}`;
			if (seen.has(key)) return;
			seen.add(key);
			unique.push(item);
		});

		return unique;
	};

	const openSimulatorWindow = (url, width, height) => {
		if (!url) return;
		const safeWidth = Math.max(420, Math.min(width + 80, 1900));
		const safeHeight = Math.max(560, Math.min(height + 120, 1400));

		if (globalThis.chrome?.windows?.create) {
			chrome.windows.create({
				url,
				type: 'popup',
				width: safeWidth,
				height: safeHeight
			});
			return;
		}

		globalThis.open(url, '_blank', `noopener,noreferrer,width=${safeWidth},height=${safeHeight}`);
	};

	const render = (container, data = {}) => {
		if (!container) return;

		const presets = normalizePresets();
		const viewport = data.viewportSize || { width: 0, height: 0, devicePixelRatio: 1 };
		const currentUrl = String(data.url || '').trim();

		const options = presets
			.map((device, index) => `<option value="${index}">${esc(device.label)} (${device.width}x${device.height})</option>`)
			.join('');

		container.innerHTML = `
			<div class="mini-kpi-grid resp-mini-grid">
				<div class="mini-kpi"><span class="mini-kpi-label">Fenetre actuelle</span><span class="mini-kpi-value">${toCount(viewport.width)} x ${toCount(viewport.height)}</span></div>
				<div class="mini-kpi"><span class="mini-kpi-label">DPR</span><span class="mini-kpi-value">${Number(viewport.devicePixelRatio || 1).toFixed(2)}</span></div>
			</div>

			<div class="resp-sim-card">
				<div class="resp-sim-head">
					<h3>Test Responsive</h3>
					<div class="resp-sim-tools">
						<select class="resp-sim-select" aria-label="Selection appareil">${options}</select>
						<button type="button" class="btn btn-secondary resp-rotate-btn">Rotation</button>
						<button type="button" class="btn btn-primary resp-open-btn">Ouvrir le simulateur</button>
					</div>
				</div>

				<div class="resp-stage">
					<div class="resp-stage-inner">
						<div class="resp-viewport-shell">
							<div class="resp-viewport-meta"></div>
							<div class="resp-viewport-frame">
								<iframe class="resp-preview-iframe" title="Apercu simulateur responsive" loading="lazy" referrerpolicy="no-referrer"></iframe>
							</div>
						</div>
					</div>
				</div>

				<p class="resp-note">Le simulateur ouvre une nouvelle fenetre securisee capable d'afficher la majorite des sites.</p>
			</div>
		`;

		const selectEl = container.querySelector('.resp-sim-select');
		const rotateBtn = container.querySelector('.resp-rotate-btn');
		const openBtn = container.querySelector('.resp-open-btn');
		const stageInnerEl = container.querySelector('.resp-stage-inner');
		const shellEl = container.querySelector('.resp-viewport-shell');
		const frameEl = container.querySelector('.resp-viewport-frame');
		const metaEl = container.querySelector('.resp-viewport-meta');
		const iframeEl = container.querySelector('.resp-preview-iframe');

		if (!selectEl || !rotateBtn || !openBtn || !stageInnerEl || !shellEl || !frameEl || !metaEl || !iframeEl) {
			return;
		}

		let selectedIndex = 0;
		let rotated = false;

		if (currentUrl) {
			iframeEl.src = currentUrl;
		} else {
			iframeEl.removeAttribute('src');
			iframeEl.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-forms');
		}

		const getSelection = () => {
			const base = presets[selectedIndex] || presets[0] || { label: 'Appareil', width: 390, height: 844 };
			const width = rotated ? base.height : base.width;
			const height = rotated ? base.width : base.height;
			return {
				label: base.label,
				width,
				height
			};
		};

		const repaint = () => {
			const current = getSelection();
			const maxWidth = Math.max(300, stageInnerEl.clientWidth - 24);
			const maxHeight = 520;
			const scale = Math.min(maxWidth / current.width, maxHeight / current.height, 1);
			const fittedWidth = Math.max(220, Math.floor(current.width * scale));
			const fittedHeight = Math.max(220, Math.floor(current.height * scale));

			shellEl.style.width = `${fittedWidth}px`;
			shellEl.style.height = `${fittedHeight + 34}px`;
			frameEl.style.width = `${fittedWidth}px`;
			frameEl.style.height = `${fittedHeight}px`;

			metaEl.textContent = `${current.label} - ${current.width} x ${current.height}${rotated ? ' (rotation)' : ''}`;
			openBtn.disabled = !currentUrl;
		};

		selectEl.addEventListener('change', () => {
			selectedIndex = toCount(selectEl.value);
			if (selectedIndex >= presets.length) selectedIndex = 0;
			repaint();
		});

		rotateBtn.addEventListener('click', () => {
			rotated = !rotated;
			repaint();
		});

		openBtn.addEventListener('click', () => {
			const current = getSelection();
			openSimulatorWindow(currentUrl, current.width, current.height);
		});

		if (globalThis.ResizeObserver) {
			const ro = new ResizeObserver(() => repaint());
			ro.observe(stageInnerEl);
		}

		repaint();
	};

	globalThis.ResponsiveModuleV2 = Object.freeze({
		render
	});
})();
