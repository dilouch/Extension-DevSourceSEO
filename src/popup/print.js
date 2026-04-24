(() => {
    const STORAGE_KEY = '__ds_capture_pending__';
    const container = document.getElementById('container');
    const printBtn = document.getElementById('btn-print');

    printBtn.addEventListener('click', () => {
        try { window.print(); } catch (e) { alert('Impression impossible: ' + e.message); }
    });

    chrome.storage.local.get([STORAGE_KEY], (result) => {
        const dataUrl = result?.[STORAGE_KEY];
        if (!dataUrl) {
            container.textContent = 'Aucune capture trouvée.';
            return;
        }
        // Nettoyer le storage immédiatement (la capture peut être lourde)
        chrome.storage.local.remove(STORAGE_KEY);

        const img = document.createElement('img');
        img.alt = 'capture';
        img.src = dataUrl;
        container.classList.remove('placeholder');
        container.innerHTML = '';
        container.appendChild(img);

        const triggerPrint = () => setTimeout(() => {
            try { window.print(); } catch (_) {}
        }, 400);

        if (img.complete) triggerPrint();
        else img.addEventListener('load', triggerPrint, { once: true });
    });
})();
