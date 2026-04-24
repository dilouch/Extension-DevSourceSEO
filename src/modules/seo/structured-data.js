(() => {
	const esc = (value) => globalThis.DomV2?.escapeHtml
		? globalThis.DomV2.escapeHtml(value)
		: String(value ?? '');

	const RULES = {
		SoftwareApplication: { required: ['name', 'applicationCategory'], recommended: ['operatingSystem', 'offers'] },
		Service: { required: ['name'], recommended: ['provider', 'areaServed'] },
		TechArticle: { required: ['headline'], recommended: ['author', 'datePublished', 'image'] },
		Person: { required: ['name'], recommended: ['url', 'jobTitle'] },
		Organization: { required: ['name', 'url'], recommended: ['logo', 'sameAs'] },
		LocalBusiness: { required: ['name', 'address', 'telephone'], recommended: ['openingHours', 'image'] },
		BreadcrumbList: { required: ['itemListElement'], recommended: [] },
		FAQPage: { required: ['mainEntity'], recommended: [] },
		Product: { required: ['name', 'offers'], recommended: ['image', 'aggregateRating'] },
		Article: { required: ['headline', 'author'], recommended: ['datePublished', 'image'] }
	};

	const injectStyles = () => {
		if (document.getElementById('sd-v2-styles')) return;
		const style = document.createElement('style');
		style.id = 'sd-v2-styles';
		style.textContent = `
			.sd-v2 { display:grid; gap:14px; }
			.sd-v2-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
			.sd-v2-title { margin:0; font-size:16px; line-height:1.05; border-bottom:2px solid #9bd4de; padding-bottom:8px; }
			.sd-v2-note { margin:4px 0 0; color:#66757d; font-size:13px; }
			.sd-v2-actions { display:flex; gap:8px; }
			.sd-v2-actions .btn { text-transform:uppercase; font-weight:800; }
			.sd-v2-score { background:linear-gradient(90deg,#12272b 0%, #0e3536 100%); color:#fff; border-radius:10px; padding:16px; display:flex; align-items:center; gap:16px; box-shadow:0 6px 14px rgba(18,39,43,.18); }
			.sd-v2-circle { width:62px; height:62px; border-radius:50%; border:4px solid #f1fd0d; color:#f1fd0d; display:flex; align-items:center; justify-content:center; font-size:30px; font-weight:900; }
			.sd-v2-score-title { margin:0; font-size:28px; letter-spacing:.03em; text-transform:uppercase; color:#c8dde0; }
			.sd-v2-score-sub { margin:2px 0 0; font-size:18px; color:#fff; }
			.sd-v2-tabs { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; background:#f3f6f7; border-radius:10px; padding:8px; }
			.sd-v2-tab { border:none; border-radius:7px; min-height:38px; font-weight:800; font-size:14px; color:#585d61; background:transparent; cursor:pointer; text-transform:uppercase; }
			.sd-v2-tab.is-active { background:#12272b; color:#f1fd0d; }
			.sd-v2-panel { display:none; }
			.sd-v2-panel.is-active { display:block; }
			.sd-v2-list { display:grid; gap:10px; }
			.sd-v2-row { border:1px solid #d6dee2; border-radius:10px; overflow:hidden; background:#fff; }
			.sd-v2-row-head { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:12px 14px; cursor:pointer; border-left:4px solid transparent; }
			.sd-v2-row-head.is-ok { border-left-color:#32c56c; }
			.sd-v2-row-head.is-warn { border-left-color:#efb034; }
			.sd-v2-row-head.is-err { border-left-color:#df4e4e; }
			.sd-v2-row-title { font-size:16px; font-weight:800; color:#243036; }
			.sd-v2-score-pill { background:#daefdf; color:#21643b; border-radius:999px; font-weight:800; font-size:13px; padding:5px 10px; }
			.sd-v2-score-pill.is-warn { background:#fff1cf; color:#845903; }
			.sd-v2-score-pill.is-err { background:#f8dbdb; color:#8a2727; }
			.sd-v2-row-body { display:none; border-top:1px solid #e8edf0; padding:12px 14px; background:#fafcfd; }
			.sd-v2-row-body.is-open { display:block; }
			.sd-v2-issues { margin:0 0 10px; padding-left:18px; font-size:13px; color:#3e4d54; }
			.sd-v2-code { margin:0; max-height:180px; overflow:auto; background:#112e31; color:#d6ecf1; border-radius:8px; padding:10px; font-size:12px; }
			.sd-v2-editor { width:100%; min-height:230px; border:1px solid #d4dce1; border-radius:8px; padding:10px; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; }
			.sd-v2-editor-actions { margin-top:10px; display:flex; gap:8px; }
			.sd-v2-tree { margin:0; max-height:340px; max-width:100%; overflow:auto; background:#0f2a2f; color:#d2eaf0; border-radius:8px; padding:12px; font-size:12px; white-space:pre-wrap; word-break:break-word; box-sizing:border-box; }
		`;
		document.head.appendChild(style);
	};

	const toType = (item) => {
		if (!item || typeof item !== 'object') return 'Unknown';
		if (item.error) return 'JSON invalide';
		if (Array.isArray(item['@type'])) return item['@type'][0] || 'Unknown';
		return item['@type'] || (item['@graph'] ? 'Graph' : 'Unknown');
	};

	const toArray = (value) => Array.isArray(value) ? value : [value];

	const flattenStructuredData = (items) => {
		const out = [];
		items.forEach((item) => {
			if (!item) return;
			if (item.error) {
				out.push(item);
				return;
			}
			if (Array.isArray(item['@graph'])) {
				item['@graph'].forEach((g) => out.push(g));
				return;
			}
			out.push(item);
		});
		return out;
	};

	const analyze = (item) => {
		if (!item || item.error) {
			return {
				score: 0,
				issues: ['Erreur de parsing JSON-LD'],
				status: 'err'
			};
		}

		const type = toType(item);
		const rules = RULES[type] || { required: [], recommended: ['name', 'description'] };
		const issues = [];
		let score = 100;

		toArray(rules.required).forEach((key) => {
			if (item[key] === undefined || item[key] === null || item[key] === '') {
				score -= 18;
				issues.push(`Champ requis manquant: ${key}`);
			}
		});

		toArray(rules.recommended).forEach((key) => {
			if (item[key] === undefined || item[key] === null || item[key] === '') {
				score -= 6;
				issues.push(`Champ recommandé manquant: ${key}`);
			}
		});

		score = Math.max(0, score);
		const status = score >= 90 ? 'ok' : score >= 60 ? 'warn' : 'err';
		return { score, issues, status };
	};

	const toCsv = (rows) => {
		const header = ['Index', 'Type', 'Score', 'Issues'];
		const lines = rows.map((row, idx) => [
			String(idx + 1),
			String(row.type),
			String(row.analysis.score),
			String(row.analysis.issues.join(' | '))
		]);
		return [header, ...lines]
			.map((line) => line.map((field) => `"${field.replace(/"/g, '""')}"`).join(','))
			.join('\n');
	};

	const downloadText = (filename, mimeType, content) => {
		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 500);
	};

	const render = (container, data) => {
		if (!container) return;
		injectStyles();

		const source = Array.isArray(data?.structuredData) ? data.structuredData : [];
		const rows = flattenStructuredData(source).map((item) => ({
			item,
			type: toType(item),
			analysis: analyze(item)
		}));

		if (!rows.length) {
			container.innerHTML = '<div class="advanced-box">Aucune donnée structurée détectée.</div>';
			return;
		}

		const average = Math.round(rows.reduce((acc, row) => acc + row.analysis.score, 0) / rows.length);
		const warningCount = rows.filter((row) => row.analysis.status !== 'ok').length;
		const domainLabel = (() => {
			try {
				return new URL(data?.url || '').hostname.toUpperCase();
			} catch (_err) {
				return 'SITE';
			}
		})();

		const listHtml = rows.map((row, idx) => {
			const statusClass = row.analysis.status === 'ok' ? 'is-ok' : row.analysis.status === 'warn' ? 'is-warn' : 'is-err';
			const issues = row.analysis.issues.length
				? row.analysis.issues.map((issue) => `<li>${esc(issue)}</li>`).join('')
				: '<li>Schéma propre, aucun point bloquant détecté.</li>';
			const pretty = row.item?.error
				? esc(row.item.raw || row.item.message || 'JSON invalide')
				: esc(JSON.stringify(row.item, null, 2));

			return `
				<div class="sd-v2-row">
					<div class="sd-v2-row-head ${statusClass}" data-sd-row="${idx}">
						<div class="sd-v2-row-title">#${idx + 1} ${esc(row.type)}</div>
						<div class="sd-v2-score-pill ${statusClass}">${row.analysis.score}/100</div>
					</div>
					<div class="sd-v2-row-body" id="sd-row-body-${idx}">
						<ul class="sd-v2-issues">${issues}</ul>
						<pre class="sd-v2-code">${pretty}</pre>
					</div>
				</div>
			`;
		}).join('');

		container.innerHTML = `
			<div class="sd-v2">
				<div class="sd-v2-head">
					<div>
						<h3 class="sd-v2-title">Données Structurées (JSON-LD)</h3>
						<p class="sd-v2-note">Cliquez sur une carte pour voir le code JSON-LD complet.</p>
					</div>
					<div class="sd-v2-actions">
						<button type="button" class="btn btn-secondary" id="sd-btn-csv">📊 CSV</button>
						<button type="button" class="btn btn-secondary" id="sd-btn-excel">📊 Excel</button>
						<button type="button" class="btn btn-primary" id="sd-btn-pdf">📄 PDF</button>
					</div>
				</div>

				<div class="sd-v2-score">
					<div class="sd-v2-circle">${average}</div>
					<div>
						<h4 class="sd-v2-score-title">Qualité ${esc(domainLabel)}</h4>
						<p class="sd-v2-score-sub">${rows.length} schémas détectés • ${warningCount} avec avertissements</p>
					</div>
				</div>

				<div class="sd-v2-tabs">
					<button type="button" class="sd-v2-tab is-active" data-sd-tab="audit">Audit</button>
					<button type="button" class="sd-v2-tab" data-sd-tab="editor">Éditeur</button>
					<button type="button" class="sd-v2-tab" data-sd-tab="tree">Arbre</button>
				</div>

				<div class="sd-v2-panel is-active" id="sd-panel-audit">
					<div class="sd-v2-list">${listHtml}</div>
				</div>

				<div class="sd-v2-panel" id="sd-panel-editor">
					<textarea id="sd-editor-input" class="sd-v2-editor">${esc(JSON.stringify(source, null, 2))}</textarea>
					<div class="sd-v2-editor-actions">
						<button type="button" class="btn btn-secondary" id="sd-editor-validate">✓ Valider JSON</button>
						<button type="button" class="btn btn-secondary" id="sd-editor-copy">📋 Copier</button>
					</div>
					<p id="sd-editor-msg" class="sd-v2-note"></p>
				</div>

				<div class="sd-v2-panel" id="sd-panel-tree">
					<pre class="sd-v2-tree">${esc(JSON.stringify(source, null, 2))}</pre>
				</div>
			</div>
		`;

		Array.from(container.querySelectorAll('[data-sd-tab]')).forEach((tab) => {
			tab.addEventListener('click', () => {
				const target = tab.getAttribute('data-sd-tab');
				Array.from(container.querySelectorAll('[data-sd-tab]')).forEach((btn) => btn.classList.remove('is-active'));
				Array.from(container.querySelectorAll('.sd-v2-panel')).forEach((panel) => panel.classList.remove('is-active'));
				tab.classList.add('is-active');
				container.querySelector(`#sd-panel-${target}`)?.classList.add('is-active');
			});
		});

		Array.from(container.querySelectorAll('[data-sd-row]')).forEach((head) => {
			head.addEventListener('click', () => {
				const idx = head.getAttribute('data-sd-row');
				container.querySelector(`#sd-row-body-${idx}`)?.classList.toggle('is-open');
			});
		});

		container.querySelector('#sd-btn-csv')?.addEventListener('click', () => {
			downloadText('schema-audit.csv', 'text/csv;charset=utf-8', toCsv(rows));
		});

		container.querySelector('#sd-btn-excel')?.addEventListener('click', () => {
			const csv = toCsv(rows).replace(/,/g, ';');
			downloadText('schema-audit.xls', 'application/vnd.ms-excel;charset=utf-8', csv);
		});

		container.querySelector('#sd-btn-pdf')?.addEventListener('click', () => {
			const printable = window.open('', '_blank');
			if (!printable) return;
			printable.document.write(`<html><head><title>Schema Audit</title></head><body><pre>${esc(JSON.stringify(rows, null, 2))}</pre></body></html>`);
			printable.document.close();
			printable.focus();
			printable.print();
		});

		container.querySelector('#sd-editor-copy')?.addEventListener('click', async () => {
			const value = container.querySelector('#sd-editor-input')?.value || '';
			try {
				await navigator.clipboard.writeText(value);
			} catch (_err) {
				// ignore clipboard errors
			}
		});

		container.querySelector('#sd-editor-validate')?.addEventListener('click', () => {
			const value = container.querySelector('#sd-editor-input')?.value || '';
			const msg = container.querySelector('#sd-editor-msg');
			if (!msg) return;
			try {
				JSON.parse(value);
				msg.textContent = 'JSON valide.';
			} catch (err) {
				msg.textContent = `Erreur JSON: ${err?.message || 'inconnue'}`;
			}
		});
	};

	globalThis.StructuredDataModuleV2 = {
		render
	};
})();
