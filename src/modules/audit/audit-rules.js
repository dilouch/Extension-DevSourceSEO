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
		},
		{
			id: 'titleLengthFine',
			label: 'Titre - longueur fine',
			weight: 4,
			test: (data) => {
				const length = String(data.title || '').length;
				if (!length) return { status: 'ok', message: 'N/A' };
				if (length < 30) return { status: 'warning', message: `Titre trop court (${length} car.) — vise 50-60` };
				if (length > 65) return { status: 'warning', message: `Titre trop long (${length} car.) — risque de troncature SERP` };
				return { status: 'ok', message: `Longueur SERP idéale (${length} car.)` };
			}
		},
		{
			id: 'descriptionLengthFine',
			label: 'Description - longueur fine',
			weight: 4,
			test: (data) => {
				const length = String(data.metaDescription || '').length;
				if (!length) return { status: 'ok', message: 'N/A' };
				if (length < 120) return { status: 'warning', message: `Description courte (${length} car.) — vise 140-160` };
				if (length > 165) return { status: 'warning', message: `Description longue (${length} car.) — peut être tronquée` };
				return { status: 'ok', message: `Longueur SERP idéale (${length} car.)` };
			}
		},
		{
			id: 'titleH1Duplicate',
			label: 'Titre vs H1',
			weight: 4,
			test: (data) => {
				const title = String(data.title || '').trim().toLowerCase();
				const h1 = String(data.h1 || '').trim().toLowerCase();
				if (!title || !h1 || h1 === '-') return { status: 'ok', message: 'N/A' };
				if (title === h1) return { status: 'warning', message: 'Titre et H1 identiques — varie pour cibler plus de requêtes' };
				return { status: 'ok', message: 'Titre et H1 différenciés' };
			}
		},
		{
			id: 'keywordInTitle',
			label: 'Mot-clé principal dans le titre',
			weight: 6,
			test: (data) => {
				const top = data.words?.[0]?.word;
				if (!top) return { status: 'ok', message: 'N/A' };
				const title = String(data.title || '').toLowerCase();
				if (!title) return { status: 'warning', message: 'Pas de titre à comparer' };
				return title.includes(top)
					? { status: 'ok', message: `Mot-clé « ${top} » présent dans le titre` }
					: { status: 'warning', message: `Mot-clé dominant « ${top} » absent du titre` };
			}
		},
		{
			id: 'keywordInDescription',
			label: 'Mot-clé principal dans la description',
			weight: 4,
			test: (data) => {
				const top = data.words?.[0]?.word;
				if (!top) return { status: 'ok', message: 'N/A' };
				const desc = String(data.metaDescription || '').toLowerCase();
				if (!desc) return { status: 'warning', message: 'Pas de description à comparer' };
				return desc.includes(top)
					? { status: 'ok', message: `Mot-clé « ${top} » présent dans la description` }
					: { status: 'warning', message: `Mot-clé dominant « ${top} » absent de la description` };
			}
		},
		{
			id: 'keywordInH1',
			label: 'Mot-clé principal dans le H1',
			weight: 4,
			test: (data) => {
				const top = data.words?.[0]?.word;
				if (!top) return { status: 'ok', message: 'N/A' };
				const h1 = String(data.h1 || '').toLowerCase();
				if (!h1 || h1 === '-') return { status: 'warning', message: 'Pas de H1 à comparer' };
				return h1.includes(top)
					? { status: 'ok', message: `Mot-clé « ${top} » présent dans le H1` }
					: { status: 'warning', message: `Mot-clé dominant « ${top} » absent du H1` };
			}
		},
		{
			id: 'keywordDensity',
			label: 'Densité du mot-clé principal',
			weight: 4,
			test: (data) => {
				const top = data.words?.[0];
				const total = Number(data.wordCount || 0);
				if (!top || total < 100) return { status: 'ok', message: 'N/A (texte trop court)' };
				const density = (top.count / total) * 100;
				const pct = density.toFixed(2);
				if (density > 5) return { status: 'warning', message: `Sur-optimisation possible « ${top.word} » (${pct}%)` };
				if (density < 0.5) return { status: 'warning', message: `Densité faible pour « ${top.word} » (${pct}%)` };
				return { status: 'ok', message: `Densité saine pour « ${top.word} » (${pct}%)` };
			}
		},
		{
			id: 'openGraph',
			label: 'Open Graph',
			weight: 6,
			test: (data) => {
				const og = data.openGraph || {};
				const has = og.title || og.image || og.url;
				if (!has) return { status: 'warning', message: 'Aucune balise Open Graph — partage social non optimisé' };
				const missing = [];
				if (!og.title) missing.push('og:title');
				if (!og.image) missing.push('og:image');
				if (!og.url) missing.push('og:url');
				if (missing.length) return { status: 'warning', message: `OG partiel — manque ${missing.join(', ')}` };
				return { status: 'ok', message: 'Open Graph complet (title, image, url)' };
			}
		},
		{
			id: 'twitterCard',
			label: 'Twitter Card',
			weight: 4,
			test: (data) => {
				const tw = data.twitterCard || {};
				if (!tw.card && !tw.title) return { status: 'warning', message: 'Twitter Card absente' };
				if (!tw.card) return { status: 'warning', message: 'twitter:card manquant' };
				return { status: 'ok', message: `Twitter Card (${tw.card})` };
			}
		},
		{
			id: 'linksBalance',
			label: 'Équilibre liens internes / externes',
			weight: 4,
			test: (data) => {
				const s = data.linkDetails?.summary || {};
				const total = Number(s.total || 0);
				if (total < 5) return { status: 'ok', message: 'N/A (peu de liens)' };
				const internal = Number(s.internal || 0);
				const external = Number(s.external || 0);
				if (internal === 0) return { status: 'warning', message: 'Aucun lien interne — maillage à renforcer' };
				if (external === 0) return { status: 'warning', message: 'Aucun lien externe — manque de citations' };
				const ratio = internal / total;
				if (ratio < 0.3) return { status: 'warning', message: `Trop peu de liens internes (${internal}/${total})` };
				if (ratio > 0.95) return { status: 'warning', message: `Quasi aucun lien externe (${external}/${total})` };
				return { status: 'ok', message: `Maillage équilibré (${internal} int. / ${external} ext.)` };
			}
		},
		{
			id: 'externalNofollow',
			label: 'Liens externes - nofollow',
			weight: 3,
			test: (data) => {
				const ext = data.linkDetails?.external || [];
				if (!ext.length) return { status: 'ok', message: 'N/A' };
				const followed = ext.filter((l) => !l.nofollow);
				if (followed.length === ext.length && ext.length > 5) {
					return { status: 'warning', message: `${ext.length} liens externes sans rel="nofollow" — vérifie la confiance des cibles` };
				}
				return { status: 'ok', message: `${ext.length - followed.length}/${ext.length} liens externes en nofollow` };
			}
		},
		{
			id: 'linksDensity',
			label: 'Densité de liens',
			weight: 3,
			test: (data) => {
				const total = Number(data.linkDetails?.summary?.total || data.counts?.links || 0);
				const words = Number(data.wordCount || 0);
				if (words < 300 || total === 0) return { status: 'ok', message: 'N/A' };
				const per100 = (total / words) * 100;
				if (per100 > 8) return { status: 'warning', message: `Trop de liens (${total} pour ${words} mots)` };
				if (per100 < 0.3 && words > 800) return { status: 'warning', message: `Peu de liens pour un long contenu (${total} pour ${words} mots)` };
				return { status: 'ok', message: `${total} liens pour ${words} mots` };
			}
		},
		{
			id: 'imagesAlt',
			label: 'Images - attribut alt',
			weight: 6,
			test: (data) => {
				const imgs = data.imageDetails || [];
				if (!imgs.length) return { status: 'ok', message: 'N/A' };
				const missing = imgs.filter((i) => !i.alt).length;
				if (missing === 0) return { status: 'ok', message: `Tous les alt présents (${imgs.length} images)` };
				const ratio = missing / imgs.length;
				if (ratio > 0.5) return { status: 'error', message: `${missing}/${imgs.length} images sans alt` };
				return { status: 'warning', message: `${missing}/${imgs.length} images sans alt` };
			}
		},
		{
			id: 'imagesLazy',
			label: 'Images - lazy loading',
			weight: 3,
			test: (data) => {
				const imgs = data.imageDetails || [];
				if (imgs.length < 5) return { status: 'ok', message: 'N/A' };
				const lazy = imgs.filter((i) => String(i.loading).toLowerCase() === 'lazy').length;
				if (lazy === 0) return { status: 'warning', message: `Aucune image en loading="lazy" (${imgs.length} images)` };
				return { status: 'ok', message: `${lazy}/${imgs.length} images en lazy loading` };
			}
		},
		{
			id: 'imagesDimensions',
			label: 'Images - dimensions explicites',
			weight: 3,
			test: (data) => {
				const imgs = data.imageDetails || [];
				if (!imgs.length) return { status: 'ok', message: 'N/A' };
				const noDims = imgs.filter((i) => !i.width || !i.height).length;
				if (noDims === 0) return { status: 'ok', message: 'Toutes les images ont width/height (CLS)' };
				const ratio = noDims / imgs.length;
				if (ratio > 0.5) return { status: 'warning', message: `${noDims}/${imgs.length} images sans width/height — CLS` };
				return { status: 'ok', message: `${noDims}/${imgs.length} images sans dimensions` };
			}
		},
		{
			id: 'favicon',
			label: 'Favicon',
			weight: 2,
			test: (data) => data.favicon
				? { status: 'ok', message: 'Favicon détectée' }
				: { status: 'warning', message: 'Favicon absente' }
		},
		{
			id: 'httpsCanonical',
			label: 'Canonical HTTPS',
			weight: 4,
			test: (data) => {
				const c = String(data.canonical || '');
				if (!c) return { status: 'ok', message: 'N/A' };
				if (c.startsWith('http://')) return { status: 'error', message: 'Canonical en HTTP — devrait être HTTPS' };
				return { status: 'ok', message: 'Canonical en HTTPS' };
			}
		},
		{
			id: 'canonicalSelf',
			label: 'Canonical cohérente',
			weight: 3,
			test: (data) => {
				const c = String(data.canonical || '');
				const u = String(data.url || '');
				if (!c || !u) return { status: 'ok', message: 'N/A' };
				try {
					const cu = new URL(c).href.replace(/\/$/, '');
					const uu = new URL(u).href.replace(/\/$/, '').split('#')[0].split('?')[0];
					if (cu === uu) return { status: 'ok', message: 'Canonical = URL courante' };
					return { status: 'warning', message: 'Canonical pointe vers une autre URL — vérifie le choix' };
				} catch (_) {
					return { status: 'ok', message: 'N/A' };
				}
			}
		},
		{
			id: 'hreflangPresence',
			label: 'Hreflang',
			weight: 2,
			test: (data) => {
				const hl = Array.isArray(data.hreflang) ? data.hreflang : [];
				if (!hl.length) return { status: 'ok', message: 'Aucun hreflang (mono-langue ?)' };
				const hasXdefault = hl.some((h) => String(h.lang).toLowerCase() === 'x-default');
				if (!hasXdefault) return { status: 'warning', message: `${hl.length} hreflang — manque x-default` };
				return { status: 'ok', message: `${hl.length} hreflang dont x-default` };
			}
		}
	];

	globalThis.AuditRulesV2 = Object.freeze({ rules });
})();