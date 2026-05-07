// Module de gestion des raccourcis clavier personnalisés
(() => {
    const SHORTCUT_STORAGE_KEY = 'v2.settings.captureShortcut';

    // Sur Mac, utiliser Cmd. Sur les autres, Ctrl
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    const DEFAULT_SHORTCUT = isMac
        ? { shift: true, alt: true, key: 'x' }
        : { ctrl: true, shift: true, key: 'x' };

    let currentShortcut = { ...DEFAULT_SHORTCUT };
    let isReady = false;

    const loadShortcut = async () => {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get([SHORTCUT_STORAGE_KEY], (result) => {
                    if (result?.[SHORTCUT_STORAGE_KEY]) {
                        currentShortcut = { ...result[SHORTCUT_STORAGE_KEY] };
                    }
                    isReady = true;
                    resolve(currentShortcut);
                });
            } catch (e) {
                isReady = true;
                resolve(currentShortcut);
            }
        });
    };

    const matchesShortcut = (e) => {
        if (!isReady) return false;
        try {
            const keyMatch = String(e.key).toLowerCase() === String(currentShortcut.key).toLowerCase();
            const ctrlMatch = Boolean(e.ctrlKey) === Boolean(currentShortcut.ctrl);
            const shiftMatch = Boolean(e.shiftKey) === Boolean(currentShortcut.shift);
            const altMatch = Boolean(e.altKey) === Boolean(currentShortcut.alt);
            const metaMatch = Boolean(e.metaKey) === Boolean(currentShortcut.meta);
            return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch;
        } catch (_) {
            return false;
        }
    };

    const handleKeydown = (e) => {
        if (!isReady || !matchesShortcut(e)) return;
        console.log('🔑 Raccourci détecté:', currentShortcut);
        e.preventDefault();
        try {
            chrome.runtime.sendMessage({
                type: 'TRIGGER_CAPTURE_FROM_CONTENT',
                mode: 'png'
            });
            console.log('✓ Message envoyé au background');
        } catch (err) {
            console.error('❌ Erreur envoi message:', err);
        }
    };

    // Écouter les changements de raccourci depuis le popup
    chrome.runtime.onMessage.addListener((message) => {
        if (message?.type === 'UPDATE_SHORTCUT' && message.shortcut) {
            currentShortcut = { ...message.shortcut };
        }
        return false;
    });

    document.addEventListener('keydown', handleKeydown, true);
    loadShortcut();

    globalThis.KeyboardShortcutV2 = Object.freeze({
        loadShortcut,
        getCurrentShortcut: () => ({ ...currentShortcut })
    });
})();
