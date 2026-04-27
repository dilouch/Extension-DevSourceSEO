// Module de l'onglet Capture : screenshot PNG et export PDF de la page active.
(() => {
    let ctx = null;

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const CAPTURE_THROTTLE_MS = 600;

    const captureVisibleSafe = async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                return await ctx.captureVisible();
            } catch (err) {
                const msg = String(err?.message || '');
                if (/MAX_CAPTURE/i.test(msg) || /quota/i.test(msg)) {
                    await wait(700);
                    continue;
                }
                throw err;
            }
        }
        throw new Error('Quota de capture Chrome atteint.');
    };

    const pngDataUrlToPdfBlob = async (pngDataUrl, jpegQuality = 0.9) => {
        const img = await ctx.loadImage(pngDataUrl);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const c = canvas.getContext('2d');
        c.fillStyle = '#ffffff';
        c.fillRect(0, 0, canvas.width, canvas.height);
        c.drawImage(img, 0, 0);

        const jpegBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', jpegQuality));
        const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());

        const W = canvas.width;
        const H = canvas.height;
        const enc = new TextEncoder();
        const parts = [];
        const offsets = [0];
        let pos = 0;
        const push = (data) => {
            const bytes = typeof data === 'string' ? enc.encode(data) : data;
            parts.push(bytes);
            pos += bytes.length;
        };

        push('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');
        offsets[1] = pos; push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
        offsets[2] = pos; push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
        offsets[3] = pos; push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);
        offsets[4] = pos; push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
        push(jpegBytes);
        push('\nendstream\nendobj\n');
        const cs = `q\n${W} 0 0 ${H} 0 0 cm\n/Im1 Do\nQ\n`;
        offsets[5] = pos; push(`5 0 obj\n<< /Length ${cs.length} >>\nstream\n${cs}endstream\nendobj\n`);
        const xrefOffset = pos;
        push('xref\n0 6\n0000000000 65535 f \n');
        for (let i = 1; i <= 5; i++) push(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
        push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

        const total = parts.reduce((s, p) => s + p.length, 0);
        const out = new Uint8Array(total);
        let off = 0;
        for (const p of parts) { out.set(p, off); off += p.length; }
        return new Blob([out], { type: 'application/pdf' });
    };

    const captureFullPage = async (tabId) => {
        await ctx.sendMessage(tabId, { type: 'PREPARE_FULLPAGE_CAPTURE' });
        await wait(300);
        try {
            const dims = await ctx.sendMessage(tabId, { type: 'GET_PAGE_DIMENSIONS' });
            if (!dims?.totalHeight || !dims?.viewportHeight || !dims?.totalWidth)
                throw new Error('Dimensions de page indisponibles.');

            const startX = Number(dims.scrollX || 0);
            const startY = Number(dims.scrollY || 0);
            const totalH = Number(dims.totalHeight);
            const totalW = Number(dims.totalWidth);
            const vpH = Number(dims.viewportHeight);
            const vpW = Number(dims.viewportWidth);
            const shots = [];
            let lastCaptureAt = 0;

            for (let y = 0; y < totalH; y += vpH) {
                const scrollY = Math.min(y, Math.max(0, totalH - vpH));
                await ctx.sendMessage(tabId, { type: 'SET_SCROLL_POSITION', x: 0, y: scrollY });
                await wait(180);
                const since = Date.now() - lastCaptureAt;
                if (since < CAPTURE_THROTTLE_MS) await wait(CAPTURE_THROTTLE_MS - since);
                const dataUrl = await captureVisibleSafe();
                lastCaptureAt = Date.now();
                shots.push({ scrollY, dataUrl });
                const pct = Math.min(100, Math.round(((scrollY + vpH) / totalH) * 100));
                ctx.setStatus(`Capture... ${pct}%`);
                if (scrollY + vpH >= totalH) break;
            }

            const first = await ctx.loadImage(shots[0].dataUrl);
            const scale = first.width / vpW;
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(totalW * scale);
            canvas.height = Math.round(totalH * scale);
            const c = canvas.getContext('2d');
            c.fillStyle = '#ffffff';
            c.fillRect(0, 0, canvas.width, canvas.height);
            for (const shot of shots) {
                const img = await ctx.loadImage(shot.dataUrl);
                c.drawImage(img, 0, Math.round(shot.scrollY * scale));
            }
            await ctx.sendMessage(tabId, { type: 'SET_SCROLL_POSITION', x: startX, y: startY });
            return canvas.toDataURL('image/png');
        } finally {
            try { await ctx.sendMessage(tabId, { type: 'RESTORE_FULLPAGE_CAPTURE' }); } catch (_) {}
        }
    };

    const run = async (mode) => {
        const tabId = ctx.getActiveTabId();
        if (!tabId) { ctx.setStatus('Onglet actif introuvable.'); return; }
        try {
            ctx.setStatus('Début capture pleine page...');
            const dataUrl = await captureFullPage(tabId);
            ctx.onCapture(dataUrl);
            if (mode === 'png') {
                const date = new Date().toISOString().replace(/[:.]/g, '-');
                chrome.downloads.download({ url: dataUrl, filename: `capture-pleine-page-${date}.png`, saveAs: true });
                ctx.setStatus('Export PNG lancé.');
                return;
            }
            ctx.setStatus('Génération du PDF...');
            const pdfBlob = await pngDataUrlToPdfBlob(dataUrl);
            const pdfUrl = URL.createObjectURL(pdfBlob);
            const date = new Date().toISOString().replace(/[:.]/g, '-');
            chrome.downloads.download({ url: pdfUrl, filename: `capture-pleine-page-${date}.pdf`, saveAs: true }, () => {
                setTimeout(() => URL.revokeObjectURL(pdfUrl), 5000);
            });
            ctx.setStatus('Export PDF lancé.');
        } catch (err) {
            ctx.setStatus(`Capture échouée: ${err?.message || 'Erreur inconnue'}`);
        }
    };

    function init(context) { ctx = context; }

    globalThis.PopupCaptureV2 = Object.freeze({ init, run });
})();
