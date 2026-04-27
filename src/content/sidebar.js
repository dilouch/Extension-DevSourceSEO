// Panneau latéral injectable dans n'importe quelle page web.
// Chargé via content_script, il crée un iframe avec le popup de l'extension.
// Ouverture/fermeture déclenchée par le message TOGGLE_SIDEBAR depuis popup.js.
(() => {
    if (window.__dsSidebarLoaded) return;
    window.__dsSidebarLoaded = true;

    const STORAGE_KEY_SIDE  = 'v2.sidebar.side';
    const STORAGE_KEY_WIDTH = 'v2.sidebar.width';
    const MIN_WIDTH = 280;
    const MAX_WIDTH = Math.round(window.innerWidth * 0.8);

    const sidebar = document.createElement('div');
    sidebar.id = 'ds-sidebar';
    sidebar.innerHTML = `
        <div id="ds-sidebar-resizer"></div>
        <div id="ds-sidebar-toolbar">
            <span id="ds-sidebar-title">⚡ Devsource SEO</span>
            <div id="ds-sidebar-toolbar-actions">
                <button id="ds-sidebar-flip" title="Changer de côté">⇄</button>
                <button id="ds-sidebar-close" title="Fermer">✕</button>
            </div>
        </div>
        <iframe src="${chrome.runtime.getURL('src/popup/popup.html')}?mode=sidebar"></iframe>
    `;

    document.body.appendChild(sidebar);

    let isOpen      = false;
    let currentSide = 'right';

    // Applique le transform selon l'état ouvert/fermé et le côté actuel
    const applyTransform = () => {
        sidebar.style.transform = isOpen
            ? 'translateX(0)'
            : currentSide === 'right' ? 'translateX(110%)' : 'translateX(-110%)';
    };

    // Déplace le panneau à gauche ou à droite et sauvegarde le choix
    const setSide = (side) => {
        currentSide = side;
        sidebar.style.right = side === 'right' ? '0' : 'auto';
        sidebar.style.left  = side === 'left'  ? '0' : 'auto';
        sidebar.classList.toggle('side-left', side === 'left');
        sidebar.style.boxShadow = side === 'right'
            ? '-4px 0 24px rgba(0,0,0,0.3)'
            : '4px 0 24px rgba(0,0,0,0.3)';
        applyTransform();
        chrome.storage.local.set({ [STORAGE_KEY_SIDE]: side });
    };

    // Ouvre ou ferme le panneau
    const toggle = () => {
        isOpen = !isOpen;
        sidebar.classList.toggle('is-open', isOpen);
        applyTransform();
    };

    sidebar.querySelector('#ds-sidebar-close').addEventListener('click', () => {
        isOpen = false;
        sidebar.classList.remove('is-open');
        applyTransform();
    });

    sidebar.querySelector('#ds-sidebar-flip').addEventListener('click', () => {
        setSide(currentSide === 'right' ? 'left' : 'right');
    });

    // Poignée de redimensionnement par drag
    const resizer = sidebar.querySelector('#ds-sidebar-resizer');
    const iframe  = sidebar.querySelector('iframe');

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        resizer.classList.add('is-resizing');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ew-resize';

        // Désactiver l'iframe pendant le drag pour éviter qu'il capte les événements souris
        if (iframe) iframe.style.pointerEvents = 'none';
        sidebar.style.transition = 'none';

        const onMouseMove = (e) => {
            const newWidth = currentSide === 'right'
                ? window.innerWidth - e.clientX
                : e.clientX;
            sidebar.style.width = `${Math.min(Math.max(newWidth, MIN_WIDTH), MAX_WIDTH)}px`;
        };

        const onMouseUp = () => {
            resizer.classList.remove('is-resizing');
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            if (iframe) iframe.style.pointerEvents = '';
            sidebar.style.transition = 'transform 0.25s ease';
            chrome.storage.local.set({ [STORAGE_KEY_WIDTH]: sidebar.offsetWidth });
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    // Charge la largeur et le côté sauvegardés
    chrome.storage.local.get([STORAGE_KEY_SIDE, STORAGE_KEY_WIDTH], (result) => {
        if (result[STORAGE_KEY_WIDTH]) {
            const saved = Number(result[STORAGE_KEY_WIDTH]);
            if (saved >= MIN_WIDTH && saved <= window.innerWidth) {
                sidebar.style.width = `${saved}px`;
            }
        }
        setSide(result[STORAGE_KEY_SIDE] || 'right');
    });

    // Écoute le message depuis le popup pour ouvrir/fermer
    chrome.runtime.onMessage.addListener((message) => {
        if (message?.type === 'TOGGLE_SIDEBAR') toggle();
    });
})();
