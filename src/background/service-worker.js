importScripts('./redirect-history.js', './network-info.js');

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

    return false;
});

