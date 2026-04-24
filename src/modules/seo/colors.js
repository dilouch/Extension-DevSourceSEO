const ColorsManager = {
    history: [],
    
    init: function() {
        const container = document.querySelector('#tab-colors .color-tools-container');
        if (!container) return;

        const existingPicker = document.getElementById('color-picker-input');
        const eyeDropperBtn = document.getElementById('btn-eyedropper');
        
        if (!document.getElementById('ds-advanced-colors-ui')) {
            const ui = document.createElement('div');
            ui.id = 'ds-advanced-colors-ui';
            ui.style.marginTop = '20px';
            ui.innerHTML = this.getTemplate();
            container.appendChild(ui);
        }

        if (existingPicker) {
            existingPicker.addEventListener('input', (e) => this.updateAll(e.target.value));
        }

        if (eyeDropperBtn) {
            eyeDropperBtn.replaceWith(eyeDropperBtn.cloneNode(true));
            document.getElementById('btn-eyedropper').addEventListener('click', async () => {
                if (!window.EyeDropper) return alert("Navigateur incompatible");
                try {
                    const res = await new EyeDropper().open();
                    this.addToHistory(res.sRGBHex);
                    this.updateAll(res.sRGBHex);
                    if(existingPicker) existingPicker.value = res.sRGBHex;
                } catch (e) {}
            });
        }

        this.attachListeners();
        this.updateAll(existingPicker ? existingPicker.value : '#12272b');
    },

    getTemplate: function() {
        return `
            <style>
                .ds-col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-family: monospace; font-size: 11px; }
                .ds-col-input { width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9; box-sizing: border-box; cursor: pointer; }
                .ds-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #666; margin: 15px 0 5px 0; border-bottom: 1px solid #eee; padding-bottom: 3px; }
                .ds-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
                .ds-pass { background: #d4edda; color: #155724; }
                .ds-fail { background: #f8d7da; color: #721c24; }
                .ds-harmony-box { height: 30px; border-radius: 4px; cursor: pointer; transition: transform 0.1s; border:1px solid rgba(0,0,0,0.1); }
                .ds-harmony-box:hover { transform: scale(1.05); }
            </style>
            <div style="background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                
                <div style="display:flex; gap:15px; align-items:center;">
                    <div id="ds-main-preview" style="width:70px; height:70px; border-radius:12px; border:1px solid #ccc; box-shadow:inset 0 0 10px rgba(0,0,0,0.1);"></div>
                    <div style="flex:1;">
                        <input type="text" id="ds-hex" readonly class="ds-col-input" style="font-size:16px; font-weight:bold; text-align:center; margin-bottom:5px;">
                        <div style="display:flex; gap:5px;">
                            <div id="ds-lum-badge" style="font-size:10px; padding:2px 5px; background:#eee; border-radius:3px;">Luminosité: -</div>
                            <button id="ds-btn-export-css" class="btn btn-secondary" style="flex:1; font-size:10px; padding:4px 8px;">📋 Copier CSS</button>
                        </div>
                    </div>
                </div>

                <div class="ds-section-title">Conversions</div>
                <div class="ds-col-grid">
                    <div><span style="color:#888;">RGB</span> <input type="text" id="ds-rgb" readonly class="ds-col-input"></div>
                    <div><span style="color:#888;">HSL</span> <input type="text" id="ds-hsl" readonly class="ds-col-input"></div>
                    <div><span style="color:#888;">CMYK</span> <input type="text" id="ds-cmyk" readonly class="ds-col-input"></div>
                    <div><span style="color:#888;">LAB</span> <input type="text" id="ds-lab" readonly class="ds-col-input"></div>
                </div>

                <div class="ds-section-title">Harmonies</div>
                <div style="display:flex; flex-direction:column; gap:5px;">
                    <div style="display:flex; gap:5px;" id="ds-harmony-comp" title="Complémentaire"></div>
                    <div style="display:flex; gap:5px;" id="ds-harmony-ana" title="Analogue"></div>
                    <div style="display:flex; gap:5px;" id="ds-harmony-tri" title="Triadique"></div>
                </div>

                <div class="ds-section-title">Nuances</div>
                <div id="ds-shades" style="display:flex; height:25px; border-radius:4px; overflow:hidden;"></div>

                <div class="ds-section-title">Accessibilité (WCAG)</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div style="background:#f4f4f4; padding:8px; border-radius:4px; text-align:center;">
                        <div style="font-size:10px; margin-bottom:3px;">Sur Blanc</div>
                        <div id="ds-wcag-white" style="font-weight:bold; font-size:14px;">-</div>
                        <div id="ds-wcag-white-res" style="font-size:10px; margin-top:2px;"></div>
                    </div>
                    <div style="background:#333; color:white; padding:8px; border-radius:4px; text-align:center;">
                        <div style="font-size:10px; margin-bottom:3px;">Sur Noir</div>
                        <div id="ds-wcag-black" style="font-weight:bold; font-size:14px;">-</div>
                        <div id="ds-wcag-black-res" style="font-size:10px; margin-top:2px;"></div>
                    </div>
                </div>

                <div class="ds-section-title">Simulateur Daltonisme</div>
                <div style="display:flex; gap:5px; justify-content:space-between;">
                    <div id="ds-sim-prot" style="height:30px; flex:1; border-radius:4px; border:1px solid #ddd;" title="Protanopie (Rouge)"></div>
                    <div id="ds-sim-deut" style="height:30px; flex:1; border-radius:4px; border:1px solid #ddd;" title="Deuteranopie (Vert)"></div>
                    <div id="ds-sim-trit" style="height:30px; flex:1; border-radius:4px; border:1px solid #ddd;" title="Tritanopie (Bleu)"></div>
                    <div id="ds-sim-mono" style="height:30px; flex:1; border-radius:4px; border:1px solid #ddd;" title="Monochromatie"></div>
                </div>
                
                <div class="ds-section-title">Historique</div>
                <div id="ds-history-row" style="display:flex; gap:5px; height:20px; overflow:hidden;"></div>
            </div>
        `;
    },

    attachListeners: function() {
        ['ds-hex','ds-rgb','ds-hsl','ds-cmyk','ds-lab'].forEach(id => {
            document.getElementById(id).onclick = (e) => this.copyToClip(e.target.value);
        });
        document.getElementById('ds-btn-export-css').onclick = () => {
            const hex = document.getElementById('ds-hex').value;
            const rgb = document.getElementById('ds-rgb').value;
            const css = `:root {\n  --color-primary: ${hex};\n  --color-primary-rgb: ${rgb.replace('rgb(','').replace(')','')};\n}`;
            this.copyToClip(css);
        };
    },

    addToHistory: function(hex) {
        if(!this.history.includes(hex)) {
            this.history.unshift(hex);
            if(this.history.length > 8) this.history.pop();
            this.renderHistory();
        }
    },

    renderHistory: function() {
        const c = document.getElementById('ds-history-row');
        c.innerHTML = '';
        this.history.forEach(h => {
            const d = document.createElement('div');
            d.style.cssText = `width:20px; height:20px; background:${h}; border-radius:3px; cursor:pointer; border:1px solid #ccc;`;
            d.title = h;
            d.onclick = () => this.updateAll(h);
            c.appendChild(d);
        });
    },

    updateAll: function(hex) {
        if (!/^#[0-9A-F]{6}$/i.test(hex)) return;

        const rgb = this.hexToRgb(hex);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
        const cmyk = this.rgbToCmyk(rgb.r, rgb.g, rgb.b);
        const lab = this.rgbToLab(rgb.r, rgb.g, rgb.b);
        
        document.getElementById('ds-main-preview').style.backgroundColor = hex;
        document.getElementById('ds-hex').value = hex.toUpperCase();
        document.getElementById('ds-rgb').value = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        document.getElementById('ds-hsl').value = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
        document.getElementById('ds-cmyk').value = `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;
        document.getElementById('ds-lab').value = `lab(${Math.round(lab.l)}, ${Math.round(lab.a)}, ${Math.round(lab.b)})`;
        document.getElementById('ds-lum-badge').innerText = `Lumi: ${(this.getLuminance(rgb)*100).toFixed(0)}%`;

        this.renderHarmonies(hsl);
        this.renderShades(hex);
        this.renderWCAG(hex);
        this.renderSimulations(rgb);
    },

    renderHarmonies: function(hsl) {
        const makeBox = (h, s, l) => {
            const rgb = this.hslToRgb(h, s, l);
            const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
            return `<div class="ds-harmony-box" style="background:${hex}; flex:1;" onclick="ColorsManager.updateAll('${hex}')" title="${hex}"></div>`;
        };

        const comp = document.getElementById('ds-harmony-comp');
        comp.innerHTML = makeBox(hsl.h, hsl.s, hsl.l) + makeBox((hsl.h + 180) % 360, hsl.s, hsl.l);

        const ana = document.getElementById('ds-harmony-ana');
        ana.innerHTML = makeBox((hsl.h - 30 + 360) % 360, hsl.s, hsl.l) + makeBox(hsl.h, hsl.s, hsl.l) + makeBox((hsl.h + 30) % 360, hsl.s, hsl.l);

        const tri = document.getElementById('ds-harmony-tri');
        tri.innerHTML = makeBox(hsl.h, hsl.s, hsl.l) + makeBox((hsl.h + 120) % 360, hsl.s, hsl.l) + makeBox((hsl.h + 240) % 360, hsl.s, hsl.l);
    },

    renderShades: function(hex) {
        const c = document.getElementById('ds-shades');
        c.innerHTML = '';
        for(let i=-40; i<=40; i+=20) {
            const s = this.adjustBrightness(hex, i);
            const d = document.createElement('div');
            d.style.cssText = `flex:1; background:${s}; cursor:pointer;`;
            d.onclick = () => this.updateAll(s);
            c.appendChild(d);
        }
    },

    renderWCAG: function(hex) {
        const lum = this.getLuminance(this.hexToRgb(hex));
        
        const check = (bgLum, fgLum, id) => {
            const l1 = Math.max(bgLum, fgLum), l2 = Math.min(bgLum, fgLum);
            const ratio = (l1 + 0.05) / (l2 + 0.05);
            const el = document.getElementById(id);
            const res = document.getElementById(id + '-res');
            el.innerText = ratio.toFixed(2);
            
            let badges = '';
            if(ratio >= 7) badges = '<span class="ds-badge ds-pass">AAA</span>';
            else if(ratio >= 4.5) badges = '<span class="ds-badge ds-pass">AA</span>';
            else if(ratio >= 3) badges = '<span class="ds-badge ds-pass">AA Large</span>';
            else badges = '<span class="ds-badge ds-fail">Fail</span>';
            res.innerHTML = badges;
        };

        check(lum, 1, 'ds-wcag-white');
        check(lum, 0, 'ds-wcag-black');
    },

    renderSimulations: function(rgb) {
        const setBg = (id, mat) => {
            const res = this.applyMatrix(rgb, mat);
            const hex = this.rgbToHex(res.r, res.g, res.b);
            const el = document.getElementById(id);
            el.style.backgroundColor = hex;
            el.onclick = () => this.updateAll(hex);
        };
        setBg('ds-sim-prot', [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758]);
        setBg('ds-sim-deut', [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7]);
        setBg('ds-sim-trit', [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525]);
        setBg('ds-sim-mono', [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114]);
    },

    copyToClip: function(txt) {
        navigator.clipboard.writeText(txt).then(() => alert(`Copié : ${txt}`));
    },

    // --- Math Utils ---

    hexToRgb: function(hex) {
        const x = parseInt(hex.replace('#',''), 16);
        return { r: (x >> 16) & 255, g: (x >> 8) & 255, b: x & 255 };
    },

    rgbToHex: function(r, g, b) {
        return "#" + [r, g, b].map(x => {
            const h = Math.min(255, Math.max(0, Math.round(x))).toString(16);
            return h.length === 1 ? "0" + h : h;
        }).join("");
    },

    rgbToHsl: function(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) h = s = 0;
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    },

    hslToRgb: function(h, s, l) {
        s /= 100; l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
    },

    rgbToCmyk: function(r, g, b) {
        let c = 1 - (r / 255), m = 1 - (g / 255), y = 1 - (b / 255), k = Math.min(c, m, y);
        c = (c - k) / (1 - k) || 0;
        m = (m - k) / (1 - k) || 0;
        y = (y - k) / (1 - k) || 0;
        return { c: Math.round(c * 100), m: Math.round(m * 100), y: Math.round(y * 100), k: Math.round(k * 100) };
    },

    rgbToLab: function(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
        g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
        b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
        let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
        let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
        let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
        x = (x > 0.008856) ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
        y = (y > 0.008856) ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
        z = (z > 0.008856) ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;
        return { l: (116 * y) - 16, a: 500 * (x - y), b: 200 * (y - z) };
    },

    getLuminance: function(rgb) {
        const a = [rgb.r, rgb.g, rgb.b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    },

    adjustBrightness: function(hex, percent) {
        const rgb = this.hexToRgb(hex);
        const amt = Math.round(2.55 * percent);
        const clamp = (n) => Math.min(255, Math.max(0, n + amt));
        return this.rgbToHex(clamp(rgb.r), clamp(rgb.g), clamp(rgb.b));
    },

    applyMatrix: function(rgb, m) {
        return {
            r: rgb.r * m[0] + rgb.g * m[1] + rgb.b * m[2],
            g: rgb.r * m[3] + rgb.g * m[4] + rgb.b * m[5],
            b: rgb.r * m[6] + rgb.g * m[7] + rgb.b * m[8]
        };
    }
};

document.addEventListener('DOMContentLoaded', () => { setTimeout(() => ColorsManager.init(), 100); });