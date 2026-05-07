importScripts('./redirect-history.js', './network-info.js');

// Gestion du raccourci clavier pour la capture
chrome.commands.onCommand.addListener((command) => {
    if (command === 'capture-screenshot') {
        // Ouvrir le popup et lancer la capture
        chrome.action.openPopup(() => {
            if (chrome.runtime.lastError) {
                console.error('Impossible d\'ouvrir le popup:', chrome.runtime.lastError);
            }
        });
        
        // Envoyer un message pour déclencher la capture après que le popup soit chargé
        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: 'TRIGGER_CAPTURE',
                mode: 'png'
            }).catch(() => {});
        }, 300);
    }
});


chrome.webRequest.onCompleted.addListener(
    (details) => {
        if (details.frameId !== 0) return;
        globalThis.RedirectHistoryV2?.push(details);
    },
    { urls: ['<all_urls>'] }
);

chrome.webRequest.onResponseStarted.addListener(
    (details) => {
        if (details.frameId !== 0) return;
        globalThis.NetworkInfoV2?.update(details);
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders']
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'GET_NETWORK_INFO') {
        const askedUrl = message.url || sender?.tab?.url || '';
        const askedTabId = typeof message.tabId === 'number' ? message.tabId : sender?.tab?.id;
        globalThis.NetworkInfoV2?.get(askedUrl, askedTabId)
            .then((info) => sendResponse(info))
            .catch(() => sendResponse({ ip: '', cdn: '', server: '' }));
        return true;
    }

    if (message?.type === 'GET_REDIRECT_HISTORY') {
        globalThis.RedirectHistoryV2?.get()
            .then((history) => sendResponse({ history }))
            .catch(() => sendResponse({ history: [] }));
        return true;
    }

    if (message?.type === 'TRIGGER_CAPTURE_FROM_CONTENT') {
        console.log('📨 Message reçu du content script');
        chrome.action.openPopup(() => {
            if (chrome.runtime.lastError) {
                console.error('❌ Erreur ouverture popup:', chrome.runtime.lastError);
            } else {
                console.log('✓ Popup ouvert');
            }
        });

        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: 'TRIGGER_CAPTURE',
                mode: message.mode || 'png'
            }).catch((err) => {
                console.error('❌ Erreur envoi TRIGGER_CAPTURE:', err);
            });
        }, 300);
        return true;
    }

    return false;
});

