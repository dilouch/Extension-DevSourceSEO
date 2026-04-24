(() => {
	const runAudit = (pageData = {}) => {
		const rules = globalThis.AuditRulesV2?.rules || [];
		const items = rules.map((rule) => {
			const result = rule.test(pageData) || { status: 'warning', message: 'Résultat indisponible' };
			return {
				id: rule.id,
				label: rule.label,
				status: result.status,
				message: result.message,
				weight: rule.weight
			};
		});

		const totalWeight = items.reduce((sum, item) => sum + Number(item.weight || 0), 0) || 1;
		const scoreWeight = items.reduce((sum, item) => {
			if (item.status === 'ok') return sum + Number(item.weight || 0);
			if (item.status === 'warning') return sum + Number(item.weight || 0) * 0.5;
			return sum;
		}, 0);
		const score = Math.max(0, Math.min(100, Math.round((scoreWeight / totalWeight) * 100)));

		return {
			score,
			items,
			stats: {
				ok: items.filter((item) => item.status === 'ok').length,
				warning: items.filter((item) => item.status === 'warning').length,
				error: items.filter((item) => item.status === 'error').length
			}
		};
	};

	globalThis.AuditEngineV2 = Object.freeze({
		runAudit
	});
})();const AuditEngine = {
    runAudit(pageData) {
        const items = [];
        let points = 0;
        const totalRules = 9;

        // Securisation des données avec des valeurs par défaut
        const data = {
            title: pageData?.title || '',
            description: pageData?.metaDescription || '',
            canonical: pageData?.canonical || '',
            robots: (pageData?.robots || '').toLowerCase(),
            lang: pageData?.lang || '',
            wordCount: Number(pageData?.wordCount) || 0,
            h1: pageData?.h1 || '',
            counts: {
                images: pageData?.counts?.images || 0,
                links: pageData?.counts?.links || 0
            }
        };

        // 1. Longueur du titre
        const titleLength = data.title.length;
        if (titleLength >= 30 && titleLength <= 65) {
            items.push({ label: 'Titre', status:'ok', message: `Longueur optimale (${titleLength} caractères)` });
            points++;
        } else if (titleLength > 0) {
            items.push({ label: 'Titre', status:'warning', message: `Longueur non optimale (${titleLength} caractères)` });
            points += 0.5;
        } else {
            items.push({ label: 'Titre', status:'error', message: 'Titre manquant' });
        }

        // 2. Meta Description
        const descLength = data.description.length;
        if (descLength >= 50 && descLength <= 160) {
            items.push({ label: 'Meta Description', status:'ok', message: `Longueur optimale (${descLength} caractères)` });
            points++;
        } else if (descLength > 0) {
            items.push({ label: 'Meta Description', status:'warning', message: `Longueur non optimale (${descLength} caractères)` });
            points += 0.5;
        } else {
            items.push({ label: 'Meta Description', status:'error', message: 'Meta description manquante' });
        }

        // 3. Présence de H1
        if (data.h1) {
            items.push({ label: 'H1', status:'ok', message: 'H1 présent' });
            points++;
        } else {
            items.push({ label: 'H1', status:'error', message: 'H1 manquant' });
        }

        // 4. Nombre d'images
        const imgCount = data.counts.images;
        if (imgCount > 0) {
            items.push({ label: 'Images', status:'ok', message: `${imgCount} image(s) trouvée(s)` });
            points++;
        } else {
            items.push({ label: 'Images', status:'warning', message: 'Aucune image trouvée' });
            points += 0.2;
        }

        // 5. Nombre de liens
        const linkCount = data.counts.links;
        if (linkCount > 0) {
            items.push({ label: 'Liens', status:'ok', message: `${linkCount} lien(s) trouvée(s)` });
            points++;
        } else {
            items.push({ label: 'Liens', status:'warning', message: 'Aucun lien trouvé' });
        }

        // 6. Présence de canonical
        if (data.canonical) {
            items.push({ label: 'Canonical', status:'ok', message: 'Balise canonical présente' });
            points++;
        } else {
            items.push({ label: 'Canonical', status:'warning', message: 'Balise canonical absente' });
        }

        // 7. Robots noindex
        if (data.robots.includes('noindex')) {
            items.push({ label: 'Robots', status:'error', message: 'NOINDEX détecté dans robots' });
        } else {
            items.push({ label: 'Robots', status:'ok', message: 'Indexation autorisée (pas de noindex)' });
            points++;
        }

        // 8. Langue déclarée
        if (data.lang.trim()) {
            items.push({ label: 'Lang', status:'ok', message: `Langue déclarée (${data.lang})` });
            points++;
        } else {
            items.push({ label: 'Lang', status:'warning', message: 'Attribut lang manquant sur <html>' });
        }

        // 9. Volume de contenu (wordCount)
        if (data.wordCount >= 600) {
            items.push({ label: 'WordCount', status:'ok', message: `Bon volume (${data.wordCount} mots)` });
            points++;
        } else if (data.wordCount >= 300) {
            items.push({ label: 'WordCount', status:'warning', message: `Volume moyen (${data.wordCount} mots)` });
            points += 0.5;
        } else {
            items.push({ label: 'WordCount', status:'error', message: `Contenu faible (${data.wordCount} mots)` });
        }

        // Calcul du score final
        const score = Math.max(0, Math.min(100, Math.round((points / totalRules) * 100)));
        
        return {
            score,
            items
        };
    }
};
window.AuditEngine = AuditEngine;