(() => {
	const rules = [
		{
			id: 'title',
			label: 'Titre',
			weight: 12,
			test: (data) => {
				const length = String(data.title || '').length;
				if (!length) return { status: 'error', message: 'Titre manquant' };
				if (length >= 30 && length <= 65) return { status: 'ok', message: `Longueur optimale (${length} caractères)` };
				return { status: 'warning', message: `Longueur atypique (${length} caractères)` };
			}
		},
		{
			id: 'description',
			label: 'Meta description',
			weight: 12,
			test: (data) => {
				const length = String(data.metaDescription || '').length;
				if (!length) return { status: 'error', message: 'Meta description manquante' };
				if (length >= 50 && length <= 160) return { status: 'ok', message: `Longueur optimale (${length} caractères)` };
				return { status: 'warning', message: `Longueur atypique (${length} caractères)` };
			}
		},
		{
			id: 'h1',
			label: 'H1',
			weight: 10,
			test: (data) => {
				const count = Number(data.headings?.counts?.H1 || 0);
				if (count === 1) return { status: 'ok', message: 'Un H1 unique détecté' };
				if (count === 0) return { status: 'error', message: 'Aucun H1 détecté' };
				return { status: 'warning', message: `${count} H1 détectés` };
			}
		},
		{
			id: 'h2',
			label: 'H2',
			weight: 4,
			test: (data) => {
				const count = Number(data.headings?.counts?.H2 || 0);
				if (count > 0) return { status: 'ok', message: `${count} H2 détecté(s)` };
				return { status: 'warning', message: 'Aucun H2 détecté' };
			}
		},
		{
			id: 'canonical',
			label: 'Canonical',
			weight: 8,
			test: (data) => data.canonical
				? { status: 'ok', message: 'Balise canonical présente' }
				: { status: 'warning', message: 'Balise canonical absente' }
		},
		{
			id: 'robots',
			label: 'Robots',
			weight: 8,
			test: (data) => {
				const robots = String(data.robots || '').toLowerCase();
				if (!robots) return { status: 'warning', message: 'Meta robots absente' };
				if (robots.includes('noindex')) return { status: 'error', message: 'NOINDEX détecté' };
				return { status: 'ok', message: 'Indexation autorisée' };
			}
		},
		{
			id: 'lang',
			label: 'Langue',
			weight: 6,
			test: (data) => data.lang
				? { status: 'ok', message: `Lang déclarée (${data.lang})` }
				: { status: 'warning', message: 'Attribut lang absent' }
		},
		{
			id: 'wordCount',
			label: 'Contenu',
			weight: 10,
			test: (data) => {
				const count = Number(data.wordCount || 0);
				if (count >= 600) return { status: 'ok', message: `Volume solide (${count} mots)` };
				if (count >= 300) return { status: 'warning', message: `Volume moyen (${count} mots)` };
				return { status: 'error', message: `Contenu faible (${count} mots)` };
			}
		},
		{
			id: 'images',
			label: 'Images',
			weight: 6,
			test: (data) => {
				const count = Number(data.counts?.images || 0);
				if (count > 0) return { status: 'ok', message: `${count} image(s) détectée(s)` };
				return { status: 'warning', message: 'Aucune image détectée' };
			}
		},
		{
			id: 'links',
			label: 'Liens',
			weight: 6,
			test: (data) => {
				const count = Number(data.counts?.links || 0);
				if (count > 0) return { status: 'ok', message: `${count} lien(s) détecté(s)` };
				return { status: 'warning', message: 'Aucun lien détecté' };
			}
		},
		{
			id: 'schema',
			label: 'Schema',
			weight: 10,
			test: (data) => {
				const count = Number(data.jsonLdCount || 0);
				if (count > 0) return { status: 'ok', message: `${count} JSON-LD détecté(s)` };
				return { status: 'warning', message: 'Aucun JSON-LD détecté' };
			}
		},
		{
			id: 'viewport',
			label: 'Viewport',
			weight: 8,
			test: (data) => data.viewport
				? { status: 'ok', message: 'Meta viewport présente' }
				: { status: 'warning', message: 'Meta viewport absente' }
		}
	];

	globalThis.AuditRulesV2 = Object.freeze({ rules });
})();