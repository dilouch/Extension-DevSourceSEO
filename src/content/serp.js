// Script injecté sur les pages de recherche Google.
// Numérote les résultats organiques et ajoute un bouton toggle pour activer/désactiver.
(() => {
    if (window.__serpBadgeLoaded) return;
    window.__serpBadgeLoaded = true;

    const badgeClass = 'devsource-serp-badge';
    const STORAGE_KEY = 'v2.serp.numbering.enabled';

    const style = document.createElement('style');
    style.textContent = `
        .${badgeClass} {
            display: inline-flex; align-items: center; justify-content: center;
            min-width: 20px; height: 20px; padding: 0 6px; margin-right: 6px;
            border-radius: 999px; background: #12272b; color: #fff;
            font-size: 11px; font-weight: 700; vertical-align: middle;
        }
        #ds-serp-toggle {
            position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
            display: inline-flex; align-items: center; gap: 7px;
            padding: 7px 13px 7px 10px; border-radius: 999px; border: none; cursor: pointer;
            font-size: 12px; font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #1e1e1e; color: #e0e0e0;
            box-shadow: 0 2px 10px rgba(0,0,0,.45);
            transition: opacity .15s;
            user-select: none;
        }
        #ds-serp-toggle:hover { opacity: .85; }
        #ds-serp-toggle .ds-dot {
            width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
            background: #22c55e; box-shadow: 0 0 5px #22c55e99;
            transition: background .2s, box-shadow .2s;
        }
        #ds-serp-toggle.is-off .ds-dot {
            background: #ef4444; box-shadow: 0 0 5px #ef444499;
        }
    `;
    document.documentElement.appendChild(style);

    // Normalise une URL en supprimant le hash
    const normalizeHref = (href) => {
        if (!href) return '';
        try {
            const url = new URL(href, location.href);
            url.hash = '';
            return url.toString();
        } catch (_) { return String(href); }
    };

    // Supprime les accents pour des comparaisons insensibles aux diacritiques
    const stripAccents = (text) =>
        String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const SKIP_PATTERNS = [
        'people also ask', 'autres questions posees', 'questions connexes',
        'related searches', 'recherches associees', 'recherches liees',
        'sponsored', 'annonce', 'publicite', 'voir plus de resultats'
    ];

    // Retourne true si le nœud doit être ignoré (pub, PAA, pack local, etc.)
    const shouldSkipResultNode = (node) => {
        if (!node) return true;
        if (node.closest('[data-text-ad]')) return true;
        if (node.closest('.commercial-unit-desktop-rhs')) return true;
        if (node.closest('.uEierd')) return true;
        if (node.querySelector('.rllt__details, [data-local-attribute], .local-pack')) return true;

        const h3 = node.querySelector('h3');
        if (!h3) return true;
        const link = h3.closest('a') || node.querySelector('a[href]');
        if (!link) return true;
        const href = String(link.getAttribute('href') || link.href || '');
        if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('#')) return true;

        const text = stripAccents(node.textContent);
        if (SKIP_PATTERNS.some((p) => text.includes(p))) return true;

        return false;
    };

    // Récupère les résultats organiques de la page de résultats Google
    const getOrganicResults = () => {
        const SELECTOR_GROUPS = [
            '#rso .MjjYud > .g',
            '#rso > .MjjYud',
            '#rso > div.g',
            '#rso > div[data-snc]',
            '#rso > div[data-hveid]',
        ];

        let candidates = [];
        for (const sel of SELECTOR_GROUPS) {
            const found = Array.from(document.querySelectorAll(sel));
            if (found.length >= 2) { candidates = found; break; }
        }

        if (candidates.length < 2) {
            candidates = Array.from(document.querySelectorAll('#rso > div, #search .MjjYud'));
        }

        const seenNode = new Set();
        const seenHref = new Set();
        const results = [];

        candidates.forEach((node) => {
            if (!node || seenNode.has(node) || shouldSkipResultNode(node)) return;
            seenNode.add(node);

            const h3 = node.querySelector('h3');
            const link = h3?.closest('a') || node.querySelector('a h3')?.closest('a') || node.querySelector('a[href]');
            if (!h3 || !link) return;

            const href = normalizeHref(link.getAttribute('href') || link.href);
            if (!href || seenHref.has(href)) return;
            seenHref.add(href);

            results.push({ node, title: h3 });
        });

        return results;
    };

    let enabled = true;
    let applying = false;
    let applyTimer = null;
    let lastResultCount = -1;

    const clearBadges = () =>
        document.querySelectorAll(`.${badgeClass}`).forEach((b) => b.remove());

    // Ajoute les badges numérotés sur les résultats organiques
    const apply = () => {
        if (!enabled) { clearBadges(); lastResultCount = -1; return; }

        // Vérification rapide : on ne refait le rendu que si le nombre de h3 a changé
        const quickCount = document.querySelectorAll('#rso h3, #search h3').length;
        if (quickCount === lastResultCount) return;

        applying = true;
        try {
            clearBadges();
            const start = Number.parseInt(new URLSearchParams(location.search).get('start') || '0', 10) || 0;
            const results = getOrganicResults();
            results.forEach((result, index) => {
                const badge = document.createElement('span');
                badge.className = badgeClass;
                badge.textContent = String(start + index + 1);
                result.title.prepend(badge);
            });
            lastResultCount = quickCount;
        } finally {
            applying = false;
        }
    };

    // Regroupe les mutations rapides en un seul appel (500ms)
    const scheduleApply = () => {
        clearTimeout(applyTimer);
        applyTimer = setTimeout(apply, 500);
    };

    // Met à jour le texte et la couleur du bouton toggle
    const updateToggleBtn = () => {
        const btn = document.getElementById('ds-serp-toggle');
        if (!btn) return;
        btn.classList.toggle('is-off', !enabled);
        const label = btn.querySelector('.ds-label');
        if (label) label.textContent = enabled ? 'SEO: ON' : 'SEO: OFF';
    };

    // Crée et insère le bouton toggle dans la page
    const createToggleBtn = () => {
        if (document.getElementById('ds-serp-toggle')) return;
        const btn = document.createElement('button');
        btn.id = 'ds-serp-toggle';
        btn.innerHTML = '<span class="ds-dot"></span><span class="ds-label"></span>';
        btn.addEventListener('click', () => {
            enabled = !enabled;
            try { chrome.storage.local.set({ [STORAGE_KEY]: enabled }); } catch (_) {}
            updateToggleBtn();
            if (enabled) apply(); else clearBadges();
        });
        document.body?.appendChild(btn);
        updateToggleBtn();
    };

    // Charge la préférence depuis le storage puis démarre
    try {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            enabled = result[STORAGE_KEY] !== false;
            apply();
            createToggleBtn();
        });
    } catch (_) {
        apply();
        createToggleBtn();
    }

    // Observe uniquement la zone des résultats #rso pour éviter les spikes CPU
    // causés par les mutations de Google sur le reste de la page (suggestions, pubs, etc.)
    const observeTarget = () => {
        const rso = document.getElementById('rso') || document.getElementById('search') || document.body;
        new MutationObserver(() => {
            if (applying) return; // ignore les mutations causées par nos propres badges
            scheduleApply();
        }).observe(rso, { childList: true, subtree: true });
    };

    if (document.getElementById('rso') || document.getElementById('search')) {
        observeTarget();
    } else {
        // Attend que #rso apparaisse puis se déconnecte
        const waitObserver = new MutationObserver(() => {
            if (document.getElementById('rso') || document.getElementById('search')) {
                waitObserver.disconnect();
                observeTarget();
            }
        });
        waitObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
})();
