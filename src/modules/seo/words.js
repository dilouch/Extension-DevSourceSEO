(() => {
	const esc = (value) => globalThis.DomV2?.escapeHtml
		? globalThis.DomV2.escapeHtml(value)
		: String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

	const render = (container, data, options = {}) => {
		if (!container) return;

		const setStatus = typeof options.setStatus === 'function' ? options.setStatus : () => {};

		const words = Array.isArray(data.words) ? data.words : [];
		const topWordsAll = words.slice(0, 30);
		const top10 = words.slice(0, 10);
		const maxCount = top10.length ? Math.max(...top10.map((w) => Number(w.count || 0))) : 1;

		const stats = data.textStats || {};
		const totalWords = Number(stats.words || data.wordCount || 0);
		const totalChars = Number(stats.characters || 0);
		const totalSentences = Number(stats.sentences || 0);
		const readingMin = Number(stats.readingMinutes || 0);
		const emails = Array.isArray(stats.emails) ? stats.emails : [];
		const phones = Array.isArray(stats.phones) ? stats.phones : [];
		const linksCount = Number(data.linkDetails?.summary?.total || 0);
		const numbersCount = Number(stats.numbers || 0);

		// Ancien design : grille des mots fréquents
		const frequentGrid = topWordsAll.length
			? `<div class="words-frequent-grid">${topWordsAll.map((item) => `
				<div class="words-frequent-item" title="${esc(item.word)} (${Number(item.count || 0)})">
					<span class="words-frequent-text">${esc(item.word)}</span>
					<span class="words-frequent-count">${Number(item.count || 0)}</span>
				</div>
			`).join('')}</div>`
			: '<div class="hint">Pas assez de contenu texte.</div>';

		// Nouveau : barres densité TOP 10
		const densityBars = top10.length
			? top10.map((item) => {
				const c = Number(item.count || 0);
				const pct = Math.max(4, Math.round((c / maxCount) * 100));
				return `
					<div class="words-density-row">
						<div class="words-density-word">${esc(item.word)}</div>
						<div class="words-density-bar-wrap">
							<div class="words-density-bar" style="width:${pct}%;"></div>
						</div>
						<div class="words-density-count">${c}</div>
					</div>
				`;
			}).join('')
			: '<div class="hint">Pas assez de contenu texte.</div>';

		container.innerHTML = `
			<!-- ANCIEN : Mots fréquents -->
			<div class="words-frequent-panel">
				<div class="words-frequent-head">
					<h3>Mots Fréquents</h3>
					<div class="btn-row">
						<button id="words-copy-btn" class="btn btn-secondary">📋 Copier</button>
						<button id="words-export-btn" class="btn btn-secondary">📊 CSV</button>
					</div>
				</div>
				${frequentGrid}
			</div>

			<!-- NOUVEAU : Stats + détections + densité -->
			<div class="words-panel" style="margin-top:16px;">
				<div class="words-stats-grid">
					<div class="words-stat-card">
						<div class="words-stat-value">${totalWords.toLocaleString('fr-FR')}</div>
						<div class="words-stat-label">MOTS</div>
					</div>
					<div class="words-stat-card">
						<div class="words-stat-value">${totalChars.toLocaleString('fr-FR')}</div>
						<div class="words-stat-label">CARACTÈRES</div>
					</div>
					<div class="words-stat-card">
						<div class="words-stat-value">${totalSentences.toLocaleString('fr-FR')}</div>
						<div class="words-stat-label">PHRASES</div>
					</div>
					<div class="words-stat-card">
						<div class="words-stat-value">${readingMin} min</div>
						<div class="words-stat-label">LECTURE</div>
					</div>
				</div>

				<div class="words-detect-grid">
					<button type="button" class="words-detect-card" data-words-detect="emails">
						<span class="words-detect-icon">📧</span>
						<span class="words-detect-label">Emails</span>
						<span class="words-detect-count">${emails.length}</span>
					</button>
					<button type="button" class="words-detect-card" data-words-detect="phones">
						<span class="words-detect-icon">📞</span>
						<span class="words-detect-label">Tél</span>
						<span class="words-detect-count">${phones.length}</span>
					</button>
					<div class="words-detect-card words-detect-card-static">
						<span class="words-detect-icon">🔗</span>
						<span class="words-detect-label">Liens</span>
						<span class="words-detect-count">${linksCount}</span>
					</div>
					<div class="words-detect-card words-detect-card-static">
						<span class="words-detect-icon">🔢</span>
						<span class="words-detect-label">Chiffres</span>
						<span class="words-detect-count">${numbersCount}</span>
					</div>
				</div>

				<div class="words-density-title">DENSITÉ SÉMANTIQUE (TOP 10)</div>
				<div class="words-density-list">${densityBars}</div>

				<div id="words-detect-detail" class="words-detect-detail" style="display:none;"></div>
			</div>
		`;

		// Handlers ancien design
		container.querySelector('#words-copy-btn')?.addEventListener('click', async () => {
			const text = topWordsAll.map((item, idx) => `${idx + 1}. ${item.word} (${Number(item.count || 0)})`).join('\n');
			try {
				await navigator.clipboard.writeText(text);
				setStatus('✅ Mots copiés dans le presse-papier.');
			} catch (_err) {
				setStatus('Copie impossible.');
			}
		});

		container.querySelector('#words-export-btn')?.addEventListener('click', () => {
			const csv = ['"#","Mot","Occurrences"', ...topWordsAll.map((item, idx) => `"${idx + 1}","${String(item.word || '').replace(/"/g, '""')}","${Number(item.count || 0)}"`)].join('\n');
			const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'mots-cles.csv';
			a.click();
			setTimeout(() => URL.revokeObjectURL(url), 300);
		});

		// Détails emails/téls au clic
		const detailEl = container.querySelector('#words-detect-detail');
		container.querySelectorAll('[data-words-detect]').forEach((btn) => {
			btn.addEventListener('click', () => {
				const kind = btn.getAttribute('data-words-detect');
				const list = kind === 'emails' ? emails : phones;
				if (!list.length) {
					if (detailEl) detailEl.style.display = 'none';
					setStatus(`Aucun ${kind === 'emails' ? 'email' : 'numéro'} détecté.`);
					return;
				}
				if (!detailEl) return;
				detailEl.style.display = 'block';
				detailEl.innerHTML = `
					<div class="words-detect-detail-head">${kind === 'emails' ? '📧 Emails détectés' : '📞 Numéros détectés'} (${list.length})</div>
					<div class="words-detect-detail-list">${list.map((v) => `<div class="words-detect-detail-item"><span>${esc(v)}</span><button class="btn btn-icon" data-copy-value="${esc(v)}" title="Copier">📋</button></div>`).join('')}</div>
				`;
				detailEl.querySelectorAll('[data-copy-value]').forEach((b) => {
					b.addEventListener('click', async () => {
						try { await navigator.clipboard.writeText(b.getAttribute('data-copy-value') || ''); setStatus('✅ Copié.'); }
						catch (_) { setStatus('Copie impossible.'); }
					});
				});
			});
		});
	};

	globalThis.WordsModuleV2 = Object.freeze({ render });
})();
