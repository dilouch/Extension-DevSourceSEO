/**
 * @fileoverview Script injecté dans chaque page web analysée.
 * Collecte toutes les données SEO (métadonnées, liens, images, couleurs, technologies, etc.)
 * et les renvoie au popup via `chrome.runtime.onMessage`.
 * @module collector
 */

(() => {
    // Éviter les injections multiples
    if (window.__devsourceLoaded) return;
    window.__devsourceLoaded = true;

    /**
     * Lit le contenu d'une balise `<meta>` via un sélecteur CSS.
     * @param {string} selector - Sélecteur CSS ciblant la balise meta (ex: `meta[name="description"]`)
     * @returns {string} La valeur de l'attribut `content`, ou une chaîne vide si absente
     */
    const getMeta = (selector) => {
        try {
            return document.querySelector(selector)?.getAttribute('content') || '';
        } catch (e) {
            return '';
        }
    };
    /**
     * Extrait et parse toutes les balises `<script type="application/ld+json">` de la page.
     * Parcourt récursivement les objets JSON pour recenser tous les types Schema.org présents.
     * @returns {{
     *   jsonLdCount: number,
     *   invalidJsonLdCount: number,
     *   jsonLdTypes: string[],
     *   jsonLdTypeCounts: Object.<string, number>,
     *   structuredData: Array<Object>
     * }}
     */
    function extractStructuredData() {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

        let jsonLdCount = scripts.length;
        let invalidJsonLdCount = 0;
        const typeCounts = {};
        const structuredData = [];

        const addType = (typeValue) => {
            if (!typeValue) return;
            const arr = Array.isArray(typeValue) ? typeValue : [typeValue];
            arr.forEach((t) => {
                const name = String(t || '').trim();
                if (!name) return;
                typeCounts[name] = (typeCounts[name] || 0) + 1;
            });
        };
        const walkNode = (node) => {
            if (!node) return;
            if (Array.isArray(node)) {
                node.forEach(walkNode);
                return;
            }
            if (typeof node !== 'object') return;
            // 1 Type direct dans le JSON-LD
            addType(node['@type']);
            // 2 Types dans un graph
            if (node['@graph']) {
                walkNode(node['@graph']);
            }

            // 3 Exploration des sous-objets pour capter des @type imbriqués
            for (const key in node) {
                if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
                if (key === '@type' || key === '@graph') continue;
                const value = node[key];
                if (value && typeof value === 'object') {
                    walkNode(value);
                }
            }
        };
        
        scripts.forEach((script) => {
            const raw = (script.textContent || '').trim();
            if (!raw) return;
            try {
                const json = JSON.parse(raw);
                structuredData.push(json);
                walkNode(json);
            } catch (e) {
                invalidJsonLdCount += 1;
                structuredData.push({
                    error: true,
                    message: String(e?.message || 'JSON invalide'),
                    raw: raw.slice(0, 4000)
                });
            }
        });
        const jsonLdTypes = Object.keys(typeCounts);
        return {
            jsonLdCount,
            invalidJsonLdCount,
            jsonLdTypes,
            jsonLdTypeCounts: typeCounts,
            structuredData
        };
    }

    /**
     * Analyse les couleurs utilisées sur la page (texte et fond) via `getComputedStyle`.
     * Limite l'analyse aux 1200 premiers nœuds DOM pour limiter l'impact sur les performances.
     * @returns {{ text: string[], background: string[], all: string[] }}
     * Les 12 couleurs de texte les plus fréquentes, les 12 couleurs de fond, et jusqu'à 24 couleurs combinées
     */
    function extractColors() {
        const textMap = new Map();
        const backgroundMap = new Map();

        const addColor = (map, color) => {
            const val = String(color || '').trim();
            if (!val || val === 'transparent' || val === 'rgba(0, 0, 0, 0)') return;
            map.set(val, (map.get(val) || 0) + 1);
        };

        const nodes = [document.body, ...Array.from(document.querySelectorAll('*')).slice(0, 1200)];
        nodes.forEach((node) => {
            if (!node) return;
            const style = window.getComputedStyle(node);
            if (!style) return;
            addColor(textMap, style.color);
            addColor(backgroundMap, style.backgroundColor);
        });

        const sortByWeight = (map) => Array.from(map.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([color]) => color);

        const text = sortByWeight(textMap).slice(0, 12);
        const background = sortByWeight(backgroundMap).slice(0, 12);
        const all = Array.from(new Set([...text, ...background])).slice(0, 24);

        return { text, background, all };
    }

    /**
     * Collecte toutes les balises `<img>` de la page avec leurs attributs principaux.
     * Filtre les images sans src.
     * @returns {Array<{ src: string, currentSrc: string, alt: string, width: number, height: number, loading: string }>}
     */
    function extractImages() {
        return Array.from(document.querySelectorAll('img')).map((img) => ({
            src: img.currentSrc || img.src || '',
            currentSrc: img.currentSrc || '',
            alt: (img.getAttribute('alt') || '').trim(),
            width: Number(img.getAttribute('width') || img.width || 0),
            height: Number(img.getAttribute('height') || img.height || 0),
            loading: (img.getAttribute('loading') || '').trim()
        })).filter((item) => item.src);
    }

    /**
     * Trouve l'URL du favicon principal via les balises `<link rel="icon">`.
     * Résout l'URL relative en URL absolue.
     * @returns {string} L'URL absolue du favicon, ou une chaîne vide si introuvable
     */
    function extractFavicon() {
        const candidates = Array.from(document.querySelectorAll('link[rel*="icon"]'));
        const first = candidates.find((el) => el.getAttribute('href'));
        if (!first) return '';
        try {
            return new URL(first.getAttribute('href'), window.location.href).href;
        } catch (_err) {
            return first.getAttribute('href') || '';
        }
    }

    /**
     * Collecte tous les titres H1 à H6 de la page avec leur niveau, texte et ordre d'apparition.
     * @returns {{ counts: Object.<string, number>, list: Array<{ level: string, index: number, order: number, text: string }>, total: number }}
     */
    function extractHeadings() {
        const levels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        const counts = { H1: 0, H2: 0, H3: 0, H4: 0, H5: 0, H6: 0 };
        const perLevelIndex = { H1: 0, H2: 0, H3: 0, H4: 0, H5: 0, H6: 0 };
        const list = [];

        const allHeadings = Array.from(document.querySelectorAll(levels.join(',')));
        allHeadings.forEach((el, orderIndex) => {
            const level = String(el.tagName || '').toUpperCase();
            
            // Try innerText first, then textContent, then recursively get text from children
            let text = (el.innerText || el.textContent || '').trim();
            
            // If still no text, try to get text from visible children
            if (!text) {
                const children = Array.from(el.children);
                text = children
                    .map(child => (child.innerText || child.textContent || '').trim())
                    .filter(Boolean)
                    .join(' ')
                    .trim();
            }
            
            counts[level] += 1;
            if (!text) return;

            perLevelIndex[level] += 1;
            list.push({
                level,
                index: perLevelIndex[level],
                order: orderIndex + 1,
                text
            });
        });

        return {
            counts,
            list,
            total: list.length
        };
    }

    /**
     * Analyse tous les liens `<a href>` de la page.
     * Classe chaque lien en interne/externe selon le hostname, et détecte l'attribut `nofollow`.
     * @returns {{
     *   summary: { total: number, internal: number, external: number, nofollow: number },
     *   all: Array<{ href: string, text: string, nofollow: boolean, isInternal: boolean, target: string }>,
     *   internal: Array,
     *   external: Array,
     *   nofollow: Array
     * }}
     */
    function extractLinkDetails() {
        const currentHost = window.location.hostname;
        const all = [];

        Array.from(document.querySelectorAll('a[href]')).forEach((a) => {
            const href = (a.getAttribute('href') || '').trim();
            if (!href) return;

            let absoluteUrl;
            try {
                absoluteUrl = new URL(href, window.location.href).href;
            } catch (_) {
                return;
            }

            let isInternal;
            try {
                const targetHost = new URL(absoluteUrl).hostname;
                isInternal = targetHost === currentHost;
            } catch (_) {
                isInternal = false;
            }

            const rel = ((a.getAttribute('rel') || '').toLowerCase()).split(/\s+/).filter(Boolean);
            const nofollow = rel.includes('nofollow');

            all.push({
                href: absoluteUrl,
                text: (a.innerText || '').trim(),
                nofollow,
                isInternal,
                target: (a.getAttribute('target') || '').trim()
            });
        });

        const internal = all.filter((link) => link.isInternal);
        const external = all.filter((link) => !link.isInternal);
        const nofollow = all.filter((link) => link.nofollow);

        return {
            summary: {
                total: all.length,
                internal: internal.length,
                external: external.length,
                nofollow: nofollow.length
            },
            all,
            internal,
            external,
            nofollow
        };
    }

    /**
     * Extrait les mots les plus fréquents du contenu textuel de la page.
     * Ignore les mots courants français (stop words), les chiffres seuls et les mots de 2 caractères ou moins.
     * @param {number} [limit=120] - Nombre maximum de mots à retourner
     * @returns {Array<{ word: string, count: number }>} Liste triée par fréquence décroissante
     */
    function extractWords(limit = 120) {
        const stopWords = new Set([
            'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'est', 'en', 'que', 'qui', 'quoi',
            'pour', 'dans', 'sur', 'par', 'avec', 'sans', 'sous', 'ce', 'cet', 'cette', 'ces', 'son', 'sa', 'ses',
            'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'notre', 'votre', 'leur', 'nos', 'vos', 'leurs',
            'il', 'elle', 'ils', 'elles', 'je', 'tu', 'nous', 'vous', 'on', 'se', 'y', 'a', 'au', 'aux',
            'mais', 'ou', 'donc', 'or', 'ni', 'car', 'pas', 'plus', 'ne', 'sont', 'ont', 'tout', 'tous',
            'toute', 'toutes', 'faire', 'être', 'avoir', 'comme', 'aussi', 'très', 'bien', 'ici', 'là', 'encore'
        ]);

        const text = (document.body?.innerText || '').toLowerCase();
        const tokens = text
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]"'’«»<>|?]/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .split(' ')
            .map((word) => word.trim())
            .filter((word) => word.length > 2 && !stopWords.has(word) && !/^\d+$/.test(word));

        const counts = {};
        tokens.forEach((word) => {
            counts[word] = (counts[word] || 0) + 1;
        });

        return Object.entries(counts)
            .map(([word, count]) => ({ word, count }))
            .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
            .slice(0, limit);
    }

    /**
     * Détecte les technologies utilisées par la page (CMS, thème, plugins, frameworks JS).
     * Utilise des patterns regex sur le HTML complet et les URLs des scripts chargés.
     * @returns {{ cms: { items: Array }, theme: { items: Array }, plugin: { items: Array }, script: { items: Array } }}
     */
    function extractTechnologies() {
        const html = document.documentElement?.outerHTML || '';
        const scripts = Array.from(document.querySelectorAll('script[src]')).map((script) => script.src);
        const tech = {
            cms: { items: [] },
            theme: { items: [] },
            plugin: { items: [] },
            script: { items: [] }
        };

        const addTech = (group, name, version = '') => {
            if (!name) return;
            tech[group].items.push({ name, version });
        };

        // CMS — patterns stricts pour éviter les faux positifs
        const generator = getMeta('meta[name="generator"]');

        const isWordPress = /wp-content\/|wp-includes\//i.test(html) || /wordpress/i.test(generator);
        if (isWordPress) addTech('cms', 'WordPress');

        // Shopify : patterns très spécifiques (pas juste le mot "shopify" qui peut apparaître dans du contenu)
        const isShopify = /cdn\.shopify\.com|Shopify\.theme|shopify-section|shopify_analytics/i.test(html)
            || /shopify/i.test(getMeta('meta[name="shopify-checkout-api-token"]'));
        if (isShopify) addTech('cms', 'Shopify');

        // Drupal
        const isDrupal = /\/sites\/default\/files\/|drupal\.js|Drupal\.settings/i.test(html)
            || /drupal/i.test(generator);
        if (isDrupal) addTech('cms', 'Drupal');

        // PrestaShop
        const isPrestaShop = /prestashop|var prestashop/i.test(html) && !/shopify/i.test(html);
        if (isPrestaShop) addTech('cms', 'PrestaShop');

        // Plugins WP — seulement si WordPress détecté
        if (isWordPress) {
            if (/woocommerce/i.test(html)) addTech('plugin', 'WooCommerce');
            if (/elementor/i.test(html)) addTech('plugin', 'Elementor');
            if (/yoast/i.test(html)) addTech('plugin', 'Yoast SEO');
            if (/rank-math|rankmath/i.test(html)) addTech('plugin', 'Rank Math');
            if (/seopress/i.test(html)) addTech('plugin', 'SEOPress');
        }

        // JS Frameworks — patterns stricts
        if (/react(?:dom)?[\\/\-][\d.]|__REACT_DEVTOOLS|_reactRootContainer/i.test(html)
            || scripts.some((s) => /react(?:\.min)?\.js|react-dom/i.test(s))) {
            addTech('script', 'React');
        }
        if (/vue(?:\.min)?\.js|__vue_/i.test(html)
            || scripts.some((s) => /vue(?:\.min)?\.js/i.test(s))) {
            addTech('script', 'Vue');
        }
        if (/ng-version|angular(?:\.min)?\.js|zone\.js/i.test(html)
            || scripts.some((s) => /angular(?:\.min)?\.js/i.test(s))) {
            addTech('script', 'Angular');
        }
        if (scripts.some((s) => /jquery(?:\.min)?\.js/i.test(s)) || /jquery\.fn\.jquery/i.test(html)) {
            addTech('script', 'jQuery');
        }
        if (scripts.some((s) => /next(?:js)?[\\/]|_next\//i.test(s)) || /__NEXT_DATA__/i.test(html)) {
            addTech('script', 'Next.js');
        }
        if (/__nuxt__|_nuxt\//i.test(html)) {
            addTech('script', 'Nuxt.js');
        }

        const themeMatch = html.match(/wp-content\/themes\/([^\/"']+)/i);
        if (themeMatch?.[1]) {
            addTech('theme', themeMatch[1].replace(/-/g, ' '));
        }

        scripts.slice(0, 30).forEach((src) => {
            const clean = src.replace(/^https?:\/\/[^/]+/i, '').split('?')[0];
            if (!clean) return;
            if (tech.script.items.length < 10) {
                tech.script.items.push({ name: clean });
            }
        });

        return tech;
    }

    /**
     * Mesure les métriques de performance de chargement de la page via l'API `PerformanceNavigationTiming`.
     * Utilise `performance.timing` comme fallback pour les anciens navigateurs.
     * @returns {{ ttfb: number, domReady: number, load: number }} Temps en millisecondes
     */
    function extractPerformance() {
        const nav = performance.getEntriesByType('navigation')[0];
        if (!nav) {
            const timing = performance.timing;
            return {
                ttfb: timing ? Math.max(0, timing.responseStart - timing.requestStart) : 0,
                domReady: timing ? Math.max(0, timing.domContentLoadedEventEnd - timing.navigationStart) : 0,
                load: timing ? Math.max(0, timing.loadEventEnd - timing.navigationStart) : 0
            };
        }

        return {
            ttfb: Math.max(0, Math.round(nav.responseStart - nav.requestStart)),
            domReady: Math.max(0, Math.round(nav.domContentLoadedEventEnd - nav.startTime)),
            load: Math.max(0, Math.round(nav.loadEventEnd - nav.startTime))
        };
    }

    const colorPickerState = {
        active: false,
        cleanup: null
    };

    /**
     * Normalise une valeur de couleur CSS en hexadécimal majuscule (`#RRGGBB`).
     * Accepte les formats `#rgb`, `#rrggbb`, `rgb()` et `rgba()`.
     * @param {string} value - La couleur CSS brute à normaliser
     * @returns {string} La couleur en HEX majuscule, ou une chaîne vide si invalide/transparente
     */
    const normalizePickedColor = (value) => {
        const input = String(value || '').trim();
        if (!input || input === 'transparent' || input === 'rgba(0, 0, 0, 0)') return '';
        const hexMatch = input.match(/^#([a-f\d]{3}|[a-f\d]{6})$/i);
        if (hexMatch) {
            const hex = hexMatch[1].length === 3
                ? hexMatch[1].split('').map((char) => `${char}${char}`).join('')
                : hexMatch[1];
            return `#${hex}`.toUpperCase();
        }
        const rgb = input.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (!rgb) return input.toUpperCase();
        const c = (n) => Number(n).toString(16).padStart(2, '0');
        return `#${c(rgb[1])}${c(rgb[2])}${c(rgb[3])}`.toUpperCase();
    };

    /**
     * Arrête la pipette de couleur active et nettoie tous les événements et éléments DOM injectés.
     */
    const stopColorPicker = () => {
        if (typeof colorPickerState.cleanup === 'function') {
            colorPickerState.cleanup();
        }
        colorPickerState.cleanup = null;
        colorPickerState.active = false;
    };

    /**
     * Lance la pipette de couleur en injectant un overlay transparent sur la page.
     * Surligne l'élément survolé et capture la couleur au clic.
     * Appuyer sur Échap annule la sélection.
     * @param {function(Object): void} sendResponse - Callback pour renvoyer la couleur sélectionnée au popup
     */
    const startColorPicker = (sendResponse) => {
        stopColorPicker();
        colorPickerState.active = true;

        const overlay = document.createElement('div');
        overlay.setAttribute('data-devsource-picker', '1');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.zIndex = '2147483647';
        overlay.style.cursor = 'crosshair';
        overlay.style.background = 'transparent';

        const info = document.createElement('div');
        info.style.position = 'fixed';
        info.style.right = '16px';
        info.style.bottom = '16px';
        info.style.padding = '9px 12px';
        info.style.borderRadius = '10px';
        info.style.font = '600 12px/1.3 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
        info.style.background = 'rgba(18, 39, 43, 0.95)';
        info.style.color = '#F1FD0D';
        info.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.22)';
        info.style.border = '1px solid rgba(241, 253, 13, 0.35)';
        info.textContent = 'Pipette active: clique un element | ESC pour annuler';

        let highlighted = null;
        let hasResponded = false;

        const clearHighlight = () => {
            if (highlighted) {
                highlighted.style.outline = highlighted.dataset.devsourceOriginalOutline || '';
                delete highlighted.dataset.devsourceOriginalOutline;
                highlighted = null;
            }
        };

        const respondOnce = (payload) => {
            if (hasResponded) return;
            hasResponded = true;
            sendResponse(payload);
        };

        const getTargetFromPoint = (x, y) => {
            overlay.style.display = 'none';
            const target = document.elementFromPoint(x, y);
            overlay.style.display = 'block';
            return target;
        };

        const onMouseMove = (event) => {
            const target = getTargetFromPoint(event.clientX, event.clientY);
            if (!(target instanceof HTMLElement) || target === overlay || target === info) return;

            if (target !== highlighted) {
                clearHighlight();
                highlighted = target;
                highlighted.dataset.devsourceOriginalOutline = highlighted.style.outline || '';
                highlighted.style.outline = '2px solid #F1FD0D';
            }
        };

        const onClick = (event) => {
            event.preventDefault();
            event.stopPropagation();

            const target = getTargetFromPoint(event.clientX, event.clientY);
            if (!(target instanceof HTMLElement)) {
                stopColorPicker();
                respondOnce({ success: false, canceled: true });
                return;
            }

            const style = window.getComputedStyle(target);
            const textColor = normalizePickedColor(style?.color);
            const backgroundColor = normalizePickedColor(style?.backgroundColor);
            const picked = backgroundColor || textColor;

            stopColorPicker();
            respondOnce({
                success: Boolean(picked),
                color: picked,
                textColor,
                backgroundColor,
                element: {
                    tag: target.tagName?.toLowerCase() || '',
                    id: target.id || '',
                    className: target.className || ''
                }
            });
        };

        const onKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            stopColorPicker();
            respondOnce({ success: false, canceled: true });
        };

        document.documentElement.appendChild(overlay);
        document.documentElement.appendChild(info);

        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKeyDown, true);

        colorPickerState.cleanup = () => {
            document.removeEventListener('mousemove', onMouseMove, true);
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('keydown', onKeyDown, true);
            clearHighlight();
            overlay.remove();
            info.remove();
        };
    };

    /**
     * Orchestre l'extraction de toutes les données SEO de la page courante.
     * Appelle toutes les fonctions `extract*` et assemble le résultat en un seul objet.
     * @returns {Object} L'objet complet des données de la page (url, title, meta, couleurs, liens, images, etc.)
     */
    function collectData() {
        const structuredData = extractStructuredData();
        const colors = extractColors();
        const headings = extractHeadings();
        const linkDetails = extractLinkDetails();
        const imageDetails = extractImages();
        const images = imageDetails.map((image) => image.src).filter(Boolean);
        const links = Array.from(document.querySelectorAll('a')).map((a) => a.href).filter(Boolean);
        const viewportSize = {
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio || 1
        };
        const words = extractWords();
        const technologies = extractTechnologies();
        const performanceTiming = extractPerformance();
        
        // Extraction du texte pour le wordCount
        const text = (document.body?.innerText || '').trim();
        const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
        const charCount = text ? text.replace(/\s+/g, '').length : 0;
        const sentenceCount = text ? (text.match(/[.!?]+(?=\s|$)/g) || []).length : 0;
        const readingMinutes = wordCount ? Math.max(1, Math.round(wordCount / 200)) : 0;
        const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        const phoneMatches = text.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/g) || [];
        const validPhones = phoneMatches.filter((p) => (p.replace(/\D/g, '').length >= 7 && p.replace(/\D/g, '').length <= 15));
        const numberMatches = text.match(/\b\d+(?:[.,]\d+)?\b/g) || [];
        const textStats = {
            words: wordCount,
            characters: charCount,
            sentences: sentenceCount,
            readingMinutes,
            emails: Array.from(new Set(emailMatches)),
            phones: Array.from(new Set(validPhones.map((p) => p.trim()))),
            numbers: numberMatches.length
        };

        // Extraction des HrefLangs (Tableau d'objets)
        const hreflangs = Array.from(document.querySelectorAll('link[hreflang]')).map(el => ({
            lang: el.getAttribute('hreflang') || '',
            href: el.getAttribute('href') || ''
        }));

        return {
            url: window.location.href,
            title: document.title || '',
            metaDescription: getMeta('meta[name="description"]'),
            keywords: getMeta('meta[name="keywords"]'),
            canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
            robots: getMeta('meta[name="robots"]'),
            lang: document.documentElement?.lang || '',
            viewport: getMeta('meta[name="viewport"]'),
            viewportSize,
            favicon: extractFavicon(),
            publisher: getMeta('meta[name="publisher"]') || getMeta('meta[property="article:publisher"]'),
            wordCount: wordCount,
            textStats,
            
            // Structure de base
            h1: Array.from(document.querySelectorAll('h1')).map((h) => h.innerText.trim()).filter(Boolean).join(' | ') || '-',
            h2: Array.from(document.querySelectorAll('h2')).map((h) => h.innerText.trim()).filter(Boolean).join(' | ') || '-',
            
            // Réseaux Sociaux (OpenGraph & Twitter)
            openGraph: {
                title: getMeta('meta[property="og:title"]'),
                image: getMeta('meta[property="og:image"]'),
                url: getMeta('meta[property="og:url"]')
            },
            twitterCard: {
                card: getMeta('meta[name="twitter:card"]'),
                title: getMeta('meta[name="twitter:title"]')
            },

            // Données techniques
            hreflang: hreflangs,
            ...structuredData,
            colors,
            headings,
            linkDetails,
            imageDetails,
            words,
            technologies,
            performanceTiming,
            
            // Données brutes pour compatibilité Factory
            images: images,
            links: links,
            counts: {
                images: images.length,
                links: links.length
            }
        };
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message?.type === 'GET_PAGE_DIMENSIONS') {
            sendResponse({
                totalWidth: Math.max(
                    document.documentElement.scrollWidth,
                    document.body?.scrollWidth || 0
                ),
                totalHeight: Math.max(
                    document.documentElement.scrollHeight,
                    document.body?.scrollHeight || 0
                ),
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                scrollX: window.scrollX,
                scrollY: window.scrollY,
                devicePixelRatio: window.devicePixelRatio || 1
            });
            return;
        }

        if (message?.type === 'SET_SCROLL_POSITION') {
            const x = Number(message?.x || 0);
            const y = Number(message?.y || 0);
            window.scrollTo(x, y);
            sendResponse({ success: true });
            return;
        }

        if (message?.type === 'PREPARE_FULLPAGE_CAPTURE') {
            try {
                // 1) Désactiver smooth-scroll
                if (!document.getElementById('__ds_fullpage_style__')) {
                    const styleEl = document.createElement('style');
                    styleEl.id = '__ds_fullpage_style__';
                    styleEl.textContent = `
                        html, body { scroll-behavior: auto !important; }
                        html.__ds-capturing__ * {
                            animation: none !important;
                            transition: none !important;
                        }
                        html.__ds-capturing__ [data-ds-fixed-hidden] { visibility: hidden !important; }
                    `;
                    document.head.appendChild(styleEl);
                }
                document.documentElement.classList.add('__ds-capturing__');

                // 2) Masquer éléments fixed/sticky (header, cookie banner, etc)
                const hidden = [];
                document.querySelectorAll('body *').forEach((el) => {
                    const cs = getComputedStyle(el);
                    if (cs.position === 'fixed' || cs.position === 'sticky') {
                        el.setAttribute('data-ds-fixed-hidden', '1');
                        hidden.push(el);
                    }
                });
                window.__dsCapturedHidden = hidden;

                // 3) Forcer chargement des images lazy
                document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
                    img.removeAttribute('loading');
                });

                // 4) Sauvegarder overflow original et bloquer (évite scrollbar qui change la largeur)
                window.__dsOriginalOverflow = document.documentElement.style.overflow;
                // On laisse l'overflow tel quel pour pouvoir scroller. Le DPR gère le reste.

                sendResponse({ success: true, hiddenCount: hidden.length });
            } catch (err) {
                sendResponse({ success: false, error: err?.message });
            }
            return true;
        }

        if (message?.type === 'RESTORE_FULLPAGE_CAPTURE') {
            try {
                document.documentElement.classList.remove('__ds-capturing__');
                const hidden = window.__dsCapturedHidden || [];
                hidden.forEach((el) => el.removeAttribute && el.removeAttribute('data-ds-fixed-hidden'));
                window.__dsCapturedHidden = null;
                if (typeof window.__dsOriginalOverflow === 'string') {
                    document.documentElement.style.overflow = window.__dsOriginalOverflow;
                    window.__dsOriginalOverflow = undefined;
                }
                sendResponse({ success: true });
            } catch (err) {
                sendResponse({ success: false, error: err?.message });
            }
            return true;
        }

        if (message?.type === 'START_COLOR_PICKER') {
            startColorPicker(sendResponse);
            return true;
        }

        if (message?.type !== 'COLLECT_DATA') return;

        try {
            const collectedData = collectData();
            
            const normalized = globalThis.PageDataV2?.createPageData
                ? globalThis.PageDataV2.createPageData(collectedData)
                : collectedData;

            sendResponse({
                success: true,
                data: normalized
            });
        } catch (err) {
            console.error('[Collector] Error:', err);
            sendResponse({
                success: false,
                error: err?.message || 'Erreur de collecte'
            });
        }
        return true; // Garde le canal ouvert pour sendResponse
    });
})();