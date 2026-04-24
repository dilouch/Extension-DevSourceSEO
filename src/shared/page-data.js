// src/shared/page-data.js
(() => {
    const DEFAULT_PAGE_DATA = Object.freeze({
        url: '',
        title: '',
        metaDescription: '',
        keywords: '',
        canonical: '',
        robots: '',
        lang: '',
        viewport: '',
        viewportSize: { width: 0, height: 0, devicePixelRatio: 1 },
        publisher: '',
        favicon: '',
        wordCount: 0,
        h1: '',
        h2: '',
        imageDetails: [],
        words: [],
        technologies: {},
        performanceTiming: { ttfb: 0, domReady: 0, load: 0 },
        // Réseaux Sociaux
        openGraph: { title: '', image: '', url: '' },
        twitterCard: { card: '', title: '' },
        // International & Technique
        hreflang: [],
        jsonLdCount: 0,
        invalidJsonLdCount: 0,
        jsonLdTypes: [],
        jsonLdTypeCounts: {},
        structuredData: [],
        colors: {
            text: [],
            background: [],
            all: []
        },
        headings: {
            counts: { H1: 0, H2: 0, H3: 0, H4: 0, H5: 0, H6: 0 },
            list: [],
            total: 0
        },
        linkDetails: {
            summary: { total: 0, internal: 0, external: 0, nofollow: 0 },
            all: [],
            internal: [],
            external: [],
            nofollow: []
        },
        // Médias & Liens
        images: '',
        links: '',
        counts: {
            images: 0,
            links: 0
        },
        timestamp: ''
    });

    const toText = (value) => typeof value === 'string' ? value : '';

    const toCount = (value) => {
        const n = Number(value);
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    };

    const toStringArray = (value) => {
        if (!Array.isArray(value)) return [];
        return value
            .map((v) => toText(v).trim())
            .filter(Boolean);
    };

    const toStringCountMap = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

        const clean = {};
        for (const [k, v] of Object.entries(value)) {
            const key = toText(k).trim();
            if (!key) continue;
            clean[key] = toCount(v);
        }
        return clean;
    };

    const countFromPipeString = (value) => {
        const txt = toText(value).trim();
        if (!txt) return 0;
        return txt.split(' | ').map((v) => v.trim()).filter(Boolean).length;
    };

    const normalizeHeadings = (value) => {
        const src = value && typeof value === 'object' ? value : {};
        const rawCounts = src.counts && typeof src.counts === 'object' ? src.counts : {};
        const counts = {
            H1: toCount(rawCounts.H1),
            H2: toCount(rawCounts.H2),
            H3: toCount(rawCounts.H3),
            H4: toCount(rawCounts.H4),
            H5: toCount(rawCounts.H5),
            H6: toCount(rawCounts.H6)
        };

        const list = Array.isArray(src.list)
            ? src.list
                .map((item) => ({
                    level: toText(item?.level),
                    index: toCount(item?.index),
                    text: toText(item?.text)
                }))
                .filter((item) => item.level && item.text)
            : [];

        return {
            counts,
            list,
            total: toCount(src.total || list.length)
        };
    };

    const normalizeLinkList = (value) => {
        if (!Array.isArray(value)) return [];
        return value
            .map((item) => ({
                href: toText(item?.href),
                text: toText(item?.text),
                nofollow: Boolean(item?.nofollow),
                isInternal: Boolean(item?.isInternal),
                target: toText(item?.target)
            }))
            .filter((item) => item.href);
    };

    const normalizeLinkDetails = (value) => {
        const src = value && typeof value === 'object' ? value : {};
        return {
            summary: {
                total: toCount(src.summary?.total),
                internal: toCount(src.summary?.internal),
                external: toCount(src.summary?.external),
                nofollow: toCount(src.summary?.nofollow)
            },
            all: normalizeLinkList(src.all),
            internal: normalizeLinkList(src.internal),
            external: normalizeLinkList(src.external),
            nofollow: normalizeLinkList(src.nofollow)
        };
    };

    const normalizeColors = (value) => {
        const src = value && typeof value === 'object' ? value : {};
        return {
            text: toStringArray(src.text),
            background: toStringArray(src.background),
            all: toStringArray(src.all)
        };
    };

    const normalizeImages = (value) => {
        if (!Array.isArray(value)) return [];
        return value.map((item) => ({
            src: toText(item?.src),
            alt: toText(item?.alt),
            width: toCount(item?.width),
            height: toCount(item?.height),
            loading: toText(item?.loading),
            currentSrc: toText(item?.currentSrc)
        })).filter((item) => item.src);
    };

    const normalizeWords = (value) => {
        if (!Array.isArray(value)) return [];
        return value.map((item) => ({
            word: toText(item?.word),
            count: toCount(item?.count)
        })).filter((item) => item.word && item.count > 0);
    };

    const normalizeTechGroup = (value) => {
        const src = value && typeof value === 'object' ? value : {};
        const items = Array.isArray(src.items)
            ? src.items.map((item) => ({
                name: toText(item?.name),
                version: toText(item?.version)
            })).filter((item) => item.name)
            : [];
        return { items };
    };

    const normalizeStructuredData = (value) => {
        if (!Array.isArray(value)) return [];

        return value
            .map((item) => {
                if (!item || typeof item !== 'object') return null;
                if (item.error) {
                    return {
                        error: true,
                        message: toText(item.message),
                        raw: toText(item.raw)
                    };
                }
                return item;
            })
            .filter(Boolean);
    };

    function createPageData(raw = {}) {
        const images = Array.isArray(raw.images)
            ? raw.images.join(' | ')
            : toText(raw.images);

        const links = Array.isArray(raw.links)
            ? raw.links.join(' | ')
            : toText(raw.links);

        const imagesCount = raw.counts?.images ?? countFromPipeString(images);
        const linksCount = raw.counts?.links ?? countFromPipeString(links);

        return {
            url: toText(raw.url),
            title: toText(raw.title),
            metaDescription: toText(raw.metaDescription),
            keywords: toText(raw.keywords),
            canonical: toText(raw.canonical),
            robots: toText(raw.robots),
            lang: toText(raw.lang),
            viewport: toText(raw.viewport),
            viewportSize: {
                width: toCount(raw.viewportSize?.width),
                height: toCount(raw.viewportSize?.height),
                devicePixelRatio: Number(raw.viewportSize?.devicePixelRatio) || 1
            },
            publisher: toText(raw.publisher),
            favicon: toText(raw.favicon),
            wordCount: toCount(raw.wordCount),
            h1: toText(raw.h1),
            h2: toText(raw.h2),
            
            // Normalisation des objets imbriqués (Réseaux Sociaux)
            openGraph: {
                title: toText(raw.openGraph?.title),
                image: toText(raw.openGraph?.image),
                url: toText(raw.openGraph?.url)
            },
            twitterCard: {
                card: toText(raw.twitterCard?.card),
                title: toText(raw.twitterCard?.title)
            },

            // Normalisation des listes et compteurs techniques
            hreflang: Array.isArray(raw.hreflang) ? raw.hreflang : [],
            jsonLdCount: toCount(raw.jsonLdCount),
            invalidJsonLdCount: toCount(raw.invalidJsonLdCount),
            jsonLdTypes: toStringArray(raw.jsonLdTypes),
            jsonLdTypeCounts: toStringCountMap(raw.jsonLdTypeCounts),
            structuredData: normalizeStructuredData(raw.structuredData),
            colors: normalizeColors(raw.colors),
            headings: normalizeHeadings(raw.headings),
            linkDetails: normalizeLinkDetails(raw.linkDetails),
            imageDetails: normalizeImages(raw.imageDetails),
            words: normalizeWords(raw.words),
            technologies: {
                cms: normalizeTechGroup(raw.technologies?.cms),
                theme: normalizeTechGroup(raw.technologies?.theme),
                plugin: normalizeTechGroup(raw.technologies?.plugin),
                script: normalizeTechGroup(raw.technologies?.script)
            },
            performanceTiming: {
                ttfb: toCount(raw.performanceTiming?.ttfb),
                domReady: toCount(raw.performanceTiming?.domReady),
                load: toCount(raw.performanceTiming?.load)
            },

            images,
            links,
            counts: {
                images: toCount(imagesCount),
                links: toCount(linksCount)
            },
            timestamp: toText(raw.timestamp) || new Date().toISOString()
        };
    }

    globalThis.PageDataV2 = {
        DEFAULT_PAGE_DATA,
        createPageData
    };
})();