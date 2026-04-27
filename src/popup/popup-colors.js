// Module de l'onglet Couleurs : pipette, palette détectée et historique des couleurs.
(() => {
    let ctx = null;
    let pickedColors = [];

    const BRAND_PALETTE_EXCLUDED = new Set([
        '#283A3B', '#FFFFFF', '#000000', '#12272B',
        '#1A3638', '#F5D002', '#CCD6DF', '#F1FD0D', '#F0F3F1'
    ]);

    const normalizeColor = (value) => {
        const source = String(value || '').trim();
        if (!source) return '';
        if (source.startsWith('#')) return source.toUpperCase();
        const hex = globalThis.UtilsV2?.rgbToHex ? globalThis.UtilsV2.rgbToHex(source) : source.toUpperCase();
        return hex && !hex.startsWith('#') ? `#${hex}` : hex;
    };

    const mergeColorData = (data) => {
        const base = data?.colors && typeof data.colors === 'object' ? data.colors : {};
        const baseAll = Array.isArray(base.all) ? base.all : [];
        const picked = pickedColors.map((item) => normalizeColor(item)).filter(Boolean);
        const all = globalThis.UtilsV2?.unique
            ? globalThis.UtilsV2.unique([...picked, ...baseAll])
            : Array.from(new Set([...picked, ...baseAll]));
        return { ...data, colors: { text: base.text || [], background: base.background || [], all } };
    };

    const clear = () => {
        pickedColors = [];
        ctx.rerenderColors();
        ctx.setStatus('Couleurs capturees videes.');
    };

    const startPicker = async () => {
        const tabId = ctx.getActiveTabId();
        if (!tabId) { ctx.setStatus('Onglet actif introuvable.'); return null; }

        // 1) Try EyeDropper API in-tab
        try {
            const result = await ctx.executeScript(tabId, async () => {
                if (!window.EyeDropper) return { success: false, reason: 'unsupported' };
                try {
                    const res = await new EyeDropper().open();
                    const color = res?.sRGBHex || '';
                    let copied = false;
                    if (color) {
                        try { await navigator.clipboard.writeText(color.toUpperCase()); copied = true; }
                        catch (_) {
                            try {
                                const ta = document.createElement('textarea');
                                ta.value = color.toUpperCase(); ta.style.cssText = 'position:fixed;opacity:0';
                                document.body.appendChild(ta); ta.select();
                                copied = document.execCommand('copy'); document.body.removeChild(ta);
                            } catch (_2) {}
                        }
                    }
                    return { success: true, color, copied };
                } catch (err) {
                    return { success: false, reason: 'aborted', message: String(err?.message || '') };
                }
            });
            if (result?.success && result?.color) {
                const hex = normalizeColor(result.color);
                pickedColors = (globalThis.UtilsV2?.unique
                    ? globalThis.UtilsV2.unique([hex, ...pickedColors])
                    : Array.from(new Set([hex, ...pickedColors]))).slice(0, 20);
                ctx.rerenderColors();
                if (result.copied) {
                    ctx.setStatus(`✅ Couleur copiée: ${hex}`);
                } else {
                    try { await ctx.copyText(hex); ctx.setStatus(`✅ Couleur copiée: ${hex}`); }
                    catch (_) { ctx.setStatus(`Couleur capturée: ${hex} (copie impossible)`); }
                }
                return hex;
            }
        } catch (_) {}

        // 2) Try ColorsModuleV2 fallback
        try {
            if (globalThis.ColorsModuleV2?.activateEyeDropper) {
                const hex = await globalThis.ColorsModuleV2.activateEyeDropper();
                if (hex) {
                    pickedColors = (globalThis.UtilsV2?.unique
                        ? globalThis.UtilsV2.unique([hex, ...pickedColors])
                        : Array.from(new Set([hex, ...pickedColors]))).slice(0, 20);
                    ctx.rerenderColors();
                    try { await ctx.copyText(hex); ctx.setStatus(`Couleur capturée et copiée: ${hex}`); }
                    catch (_) { ctx.setStatus(`Couleur capturée: ${hex} (copie impossible)`); }
                    return hex;
                }
            }
        } catch (_) {}

        // 3) Fallback: content script color picker
        ctx.setStatus('Pipette active: clique une couleur sur la page.');
        try {
            const response = await ctx.sendMessage(tabId, { type: 'START_COLOR_PICKER' });
            if (!response?.success || !response?.color) {
                ctx.setStatus(response?.canceled ? 'Pipette annulee.' : 'Aucune couleur capturee.');
                return null;
            }
            const color = normalizeColor(response.color);
            if (!color) { ctx.setStatus('Couleur non exploitable.'); return null; }
            pickedColors = (globalThis.UtilsV2?.unique
                ? globalThis.UtilsV2.unique([color, ...pickedColors])
                : Array.from(new Set([color, ...pickedColors]))).slice(0, 20);
            ctx.rerenderColors();
            try { await ctx.copyText(color); ctx.setStatus(`Couleur capturée et copiée: ${color}`); }
            catch (_) { ctx.setStatus(`Couleur capturée: ${color} (copie impossible)`); }
            return color;
        } catch (err) {
            ctx.setStatus(`Pipette indisponible: ${err?.message || 'erreur inconnue'}`);
            return null;
        }
    };

    const render = (container, data) => {
        if (!container || !data) return;
        const merged = mergeColorData(data);
        const picker = document.getElementById('color-picker-input');
        const swatchesWrap = document.getElementById('colors-detected-list');
        if (!picker || !swatchesWrap) return;

        const toHex = (value) => {
            const source = String(value || '').trim();
            if (!source) return '';
            if (source.startsWith('#')) {
                const raw = source.slice(1);
                if (raw.length === 3) return `#${raw.split('').map((c) => `${c}${c}`).join('')}`.toUpperCase();
                if (raw.length === 6) return `#${raw}`.toUpperCase();
                return source.toUpperCase();
            }
            return normalizeColor(source);
        };

        const allColors = Array.isArray(merged.colors?.all) ? merged.colors.all : [];
        const deduped = (globalThis.UtilsV2?.unique
            ? globalThis.UtilsV2.unique(allColors.map(toHex).filter((c) => /^#[0-9A-F]{6}$/i.test(c)))
            : Array.from(new Set(allColors.map(toHex).filter((c) => /^#[0-9A-F]{6}$/i.test(c))))).filter((h) => !BRAND_PALETTE_EXCLUDED.has(h));

        if (deduped.length) {
            picker.value = deduped[0];
            swatchesWrap.innerHTML = deduped.slice(0, 18).map((hex) => `
                <button type="button" class="swatch" data-color="${hex}" title="Appliquer ${hex}">
                    <span class="swatch-chip" style="background:${hex}"></span>
                    <span class="swatch-meta">
                        <span class="swatch-code">${hex}</span>
                        <span class="swatch-label">Appliquer</span>
                    </span>
                </button>`).join('');
        } else {
            swatchesWrap.innerHTML = '<div class="hint">Aucune couleur detectee.</div>';
        }

        if (globalThis.ColorsManager?.init && !document.getElementById('ds-advanced-colors-ui')) {
            globalThis.ColorsManager.init();
        }
        if (globalThis.ColorsManager?.updateAll && /^#[0-9A-F]{6}$/i.test(picker.value)) {
            globalThis.ColorsManager.updateAll(picker.value);
        }

        if (!swatchesWrap.dataset.bound) {
            swatchesWrap.dataset.bound = '1';
            swatchesWrap.addEventListener('click', (e) => {
                const btn = e.target?.closest('[data-color]');
                if (!(btn instanceof HTMLElement)) return;
                const hex = btn.getAttribute('data-color') || '';
                if (!/^#[0-9A-F]{6}$/i.test(hex)) return;
                picker.value = hex;
                globalThis.ColorsManager?.addToHistory?.(hex);
                globalThis.ColorsManager?.updateAll?.(hex);
            });
        }
        if (!picker.dataset.bound) {
            picker.dataset.bound = '1';
            picker.addEventListener('input', () => globalThis.ColorsManager?.updateAll?.(picker.value));
        }

        const eyedropperBtn = document.getElementById('btn-eyedropper');
        if (eyedropperBtn && !eyedropperBtn.dataset.bound) {
            eyedropperBtn.dataset.bound = '1';
            eyedropperBtn.addEventListener('click', async () => {
                const picked = await startPicker();
                if (!picked) return;
                const hex = toHex(picked);
                if (!/^#[0-9A-F]{6}$/i.test(hex)) return;
                picker.value = hex;
                globalThis.ColorsManager?.addToHistory?.(hex);
                globalThis.ColorsManager?.updateAll?.(hex);
            });
        }
        const copyPickerBtn = document.getElementById('btn-copy-picker-color');
        if (copyPickerBtn && !copyPickerBtn.dataset.bound) {
            copyPickerBtn.dataset.bound = '1';
            copyPickerBtn.addEventListener('click', async () => {
                const hex = String(picker.value || '').toUpperCase();
                if (!hex) { ctx.setStatus('Aucune couleur active.'); return; }
                try {
                    await ctx.copyText(hex);
                    ctx.setStatus(`✅ Couleur copiée: ${hex}`);
                    const orig = copyPickerBtn.textContent;
                    copyPickerBtn.textContent = '✅ Copié';
                    setTimeout(() => { copyPickerBtn.textContent = orig; }, 1000);
                } catch (_) { ctx.setStatus('❌ Impossible de copier.'); }
            });
        }
    };

    function init(context) { ctx = context; }

    globalThis.PopupColorsV2 = Object.freeze({ init, render, startPicker, clear });
})();
