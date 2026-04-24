(() => {
	const esc = (value) => globalThis.DomV2?.escapeHtml
		? globalThis.DomV2.escapeHtml(value)
		: String(value ?? '');

	const toCount = (value) => {
		const n = Number(value);
		return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
	};

	function prepare(data = {}) {
		const headings = data.headings && typeof data.headings === 'object' ? data.headings : {};
		const counts = headings.counts && typeof headings.counts === 'object' ? headings.counts : {};

		const normalizedCounts = {
			H1: toCount(counts.H1),
			H2: toCount(counts.H2),
			H3: toCount(counts.H3),
			H4: toCount(counts.H4),
			H5: toCount(counts.H5),
			H6: toCount(counts.H6)
		};

		const list = Array.isArray(headings.list)
			? headings.list
				.filter((item) => item?.level && item?.text)
				.map((item, index) => ({
					level: String(item.level || '').toUpperCase(),
					text: String(item.text || ''),
					index: toCount(item.index || index + 1),
					order: toCount(item.order || index + 1)
				}))
			: [];

		return {
			counts: normalizedCounts,
			total: toCount(headings.total || list.length),
			list
		};
	}

	function buildRows(items) {
		if (!items.length) {
			return '<div class="hn-row hn-row-empty">Aucun titre detecte</div>';
		}

		return items.map((item) => {
			const levelNum = Number.parseInt(String(item.level).replace('H', ''), 10) || 1;
			const pad = Math.max(0, levelNum - 1) * 20;
			return `
				<div class="hn-row" data-level="${esc(item.level)}">
					<div class="hn-row-line" style="padding-left:${pad}px;">
						<span class="hn-row-level">${esc(item.level)}:</span>
						<span class="hn-row-text">${esc(item.text)}</span>
					</div>
				</div>
			`;
		}).join('');
	}

	function toCsv(rows) {
		const header = ['Order', 'Level', 'Text'];
		const body = rows.map((item, idx) => [
			String(item.order || idx + 1),
			String(item.level || ''),
			String(item.text || '')
		]);
		const all = [header, ...body];
		return all
			.map((line) => line.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(','))
			.join('\n');
	}

	function downloadText(filename, mimeType, content) {
		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 300);
	}

	function render(container, data) {
		if (!container) return;

		const prepared = prepare(data);
		const levels = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
		const countItems = levels
			.map((level) => `<button type="button" class="hn-pill" data-filter-level="${level}"><span class="hn-pill-label">${level}:</span><span class="hn-pill-value">${prepared.counts[level]}</span></button>`)
			.join('');
		const rowsHtml = buildRows(prepared.list);

		container.innerHTML = `
            <div class="hn-panel">
                <div class="hn-pills-wrap">${countItems}</div>
                <div class="hn-card">
                    <div class="hn-card-head" style="border-bottom: none;">
                        <h3>Structure Detaillee</h3>
                        <div class="hn-actions">
                            <button type="button" id="hn-btn-reset" class="btn btn-secondary">🔄 Reset</button>
                            <button type="button" id="hn-btn-copy" class="btn btn-secondary">📋 Copier</button>
                            <button type="button" id="hn-btn-csv" class="btn btn-secondary">📊 CSV</button>
                            <button type="button" id="hn-btn-excel" class="btn btn-secondary">📊 Excel</button>
                        </div>
                    </div>
                    <div id="hn-list" class="hn-list" style="border-top: none; padding-top: 0;">${rowsHtml}</div>
                </div>
            </div>
        `;

		const pills = Array.from(container.querySelectorAll('[data-filter-level]'));
		const listEl = container.querySelector('#hn-list');
		let activeLevel = '';

		const renderRows = () => {
			const rows = activeLevel
				? prepared.list.filter((item) => item.level === activeLevel)
				: prepared.list;
			if (listEl) listEl.innerHTML = buildRows(rows);

			pills.forEach((pill) => {
				const level = pill.getAttribute('data-filter-level') || '';
				pill.classList.toggle('is-active', level === activeLevel);
			});
		};

		pills.forEach((pill) => {
			pill.addEventListener('click', () => {
				const level = pill.getAttribute('data-filter-level') || '';
				activeLevel = activeLevel === level ? '' : level;
				renderRows();
			});
		});

		container.querySelector('#hn-btn-reset')?.addEventListener('click', () => {
			activeLevel = '';
			renderRows();
		});

		container.querySelector('#hn-btn-copy')?.addEventListener('click', async () => {
			const rows = activeLevel
				? prepared.list.filter((item) => item.level === activeLevel)
				: prepared.list;
			const text = rows.map((item) => `${item.level}: ${item.text}`).join('\n');
			try {
				await navigator.clipboard.writeText(text);
			} catch (_err) {
				// ignore clipboard errors in restricted contexts
			}
		});

		container.querySelector('#hn-btn-csv')?.addEventListener('click', () => {
			const rows = activeLevel
				? prepared.list.filter((item) => item.level === activeLevel)
				: prepared.list;
			downloadText('headings.csv', 'text/csv;charset=utf-8', toCsv(rows));
		});

		container.querySelector('#hn-btn-excel')?.addEventListener('click', () => {
			const rows = activeLevel
				? prepared.list.filter((item) => item.level === activeLevel)
				: prepared.list;
			const html = [
				'<table><thead><tr><th>Order</th><th>Level</th><th>Text</th></tr></thead><tbody>',
				...rows.map((item, idx) => `<tr><td>${item.order || idx + 1}</td><td>${esc(item.level)}</td><td>${esc(item.text)}</td></tr>`),
				'</tbody></table>'
			].join('');
			downloadText('headings.xls', 'application/vnd.ms-excel;charset=utf-8', html);
		});
	}

	globalThis.HeadingsModuleV2 = {
		prepare,
		render
	};
})();
