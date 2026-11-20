// plugins/design.js — WEBSITE DESIGN DETAILS
//   .design <website link>     (alias: .webdesign  .sitedesign  .designinfo)
// Kisi bhi website ke design ki details nikalta hai: colors (palette image ke saath), fonts,
// CSS variables, border-radius / shadows / gradients, breakpoints, framework (Tailwind, Bootstrap, React ...).
//
// Safety: sirf public http/https sites. localhost / private IP / internal addresses block hain.
// Limit: sirf HTML + linked CSS padhta hai. JS se banne wale (CSS-in-JS) styles nahi dikh sakte.

const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');
const axios = require('axios');
const { cmd } = require('../arslan');
const config = require('../config');

const P = () => config.PREFIX || '.';
const MAX_HTML = 2 * 1024 * 1024;      // 2MB
const MAX_CSS = 1.5 * 1024 * 1024;     // har CSS file 1.5MB tak
const MAX_CSS_FILES = 5;
const TIMEOUT_MS = 12000;
const COOLDOWN_MS = 10000;
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

// ───────────────────────── SSRF guard ─────────────────────────
function isPrivateIp(ip) {
    ip = String(ip || '').toLowerCase();
    if (ip.startsWith('::ffff:')) ip = ip.slice(7);          // IPv4-mapped IPv6
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return a === 0 || a === 10 || a === 127 || a >= 224 ||
            (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
    }
    if (net.isIPv6(ip)) {
        return ip === '::' || ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') ||
            ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb');
    }
    return true;   // samajh na aaye to block
}

function safeLookup(hostname, options, callback) {
    if (typeof options === 'function') { callback = options; options = {}; }
    dns.lookup(hostname, { ...(options || {}), all: true }, (err, addrs) => {
        if (err) return callback(err);
        const bad = addrs.find(a => isPrivateIp(a.address));
        if (bad) return callback(new Error('Private / internal address allowed nahi hai.'));
        if (options && options.all) return callback(null, addrs);
        callback(null, addrs[0].address, addrs[0].family);
    });
}
const httpAgent = new http.Agent({ lookup: safeLookup });
const httpsAgent = new https.Agent({ lookup: safeLookup });

function parseUrl(input) {
    let raw = String(input || '').trim().replace(/^<|>$/g, '');
    if (!raw) throw new Error('Link nahi diya.');
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'https://' + raw;
    let u;
    try { u = new URL(raw); } catch (_) { throw new Error('Link sahi nahi hai.'); }
    if (!/^https?:$/.test(u.protocol)) throw new Error('Sirf http / https link chalega.');
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
        throw new Error('Ye address allowed nahi hai.');
    }
    if (net.isIP(host) && isPrivateIp(host)) throw new Error('Ye address allowed nahi hai.');
    if (u.port && !['80', '443', '8080', '8443'].includes(u.port)) throw new Error('Is port ki ijazat nahi hai.');
    return u;
}

async function fetchText(url, maxBytes, wantType) {
    let current = parseUrl(url);
    for (let hop = 0; hop < 5; hop++) {
        const res = await axios.get(current.href, {
            responseType: 'text',
            transformResponse: [d => d],
            timeout: TIMEOUT_MS,
            maxContentLength: maxBytes,
            maxBodyLength: maxBytes,
            maxRedirects: 0,
            validateStatus: s => s < 400,
            httpAgent, httpsAgent,
            headers: { 'User-Agent': UA, 'Accept': wantType === 'css' ? 'text/css,*/*;q=0.1' : 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' }
        });
        if (res.status >= 300 && res.status < 400 && res.headers.location) {
            current = parseUrl(new URL(res.headers.location, current).href);   // har redirect dobara check
            continue;
        }
        return { text: typeof res.data === 'string' ? res.data : String(res.data || ''), headers: res.headers || {}, url: current.href };
    }
    throw new Error('Bahut zyada redirects.');
}

// ───────────────────────── colors ─────────────────────────
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const toHex2 = n => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');

function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return { h: 0, s: 0, l };
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: h * 60, s, l };
}

const num = v => parseFloat(String(v).replace('%', ''));

function normColor(token) {
    token = String(token).trim().toLowerCase();
    let m;
    if ((m = token.match(/^#([0-9a-f]{3,8})$/))) {
        let h = m[1];
        if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
        if (h.length === 8) { if (parseInt(h.slice(6), 16) < 40) return null; h = h.slice(0, 6); }   // almost transparent
        if (h.length !== 6) return null;
        return '#' + h;
    }
    if ((m = token.match(/^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:[\s,/]+([\d.]+%?))?\s*\)$/))) {
        const ch = v => String(v).endsWith('%') ? num(v) * 2.55 : num(v);
        if (m[4] !== undefined) { const a = String(m[4]).endsWith('%') ? num(m[4]) / 100 : num(m[4]); if (a < 0.15) return null; }
        return '#' + toHex2(ch(m[1])) + toHex2(ch(m[2])) + toHex2(ch(m[3]));
    }
    if ((m = token.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/))) {
        if (m[4] !== undefined) { const a = String(m[4]).endsWith('%') ? num(m[4]) / 100 : num(m[4]); if (a < 0.15) return null; }
        const [r, g, b] = hslToRgb(num(m[1]), num(m[2]) / 100, num(m[3]) / 100);
        return '#' + toHex2(r) + toHex2(g) + toHex2(b);
    }
    return null;
}

const COLOR_RE = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]{5,40}\)|hsla?\([^)]{5,40}\)/g;

function collectColors(css) {
    const counts = new Map();
    for (const tok of css.match(COLOR_RE) || []) {
        const hex = normColor(tok);
        if (hex) counts.set(hex, (counts.get(hex) || 0) + 1);
    }
    const accents = [], neutrals = [];
    for (const [hex, n] of counts) {
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        const { s, l } = rgbToHsl(r, g, b);
        (s > 0.18 && l > 0.08 && l < 0.94 ? accents : neutrals).push({ hex, n, s, l });
    }
    const byCount = (a, b) => b.n - a.n;
    // milte-julte colors (bahut qareeb) ek hi samjho taake list mein 10 shades ek jaisi na aayen
    const dedupe = (arr, limit) => {
        const out = [];
        for (const c of arr.sort(byCount)) {
            const rgb = [1, 3, 5].map(i => parseInt(c.hex.slice(i, i + 2), 16));
            if (out.some(o => Math.hypot(...rgb.map((v, i) => v - o.rgb[i])) < 24)) continue;
            out.push({ ...c, rgb });
            if (out.length >= limit) break;
        }
        return out;
    };
    return { accents: dedupe(accents, 8), neutrals: dedupe(neutrals, 4), total: counts.size };
}

function colorName(hex) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const { h, s, l } = rgbToHsl(r, g, b);
    if (l < 0.1) return 'Black';
    if (l > 0.93) return 'White';
    if (s < 0.12) return l < 0.35 ? 'Dark Gray' : l < 0.65 ? 'Gray' : 'Light Gray';
    const base = h < 15 || h >= 345 ? 'Red' : h < 40 ? 'Orange' : h < 65 ? 'Yellow' : h < 90 ? 'Lime' : h < 160 ? 'Green' : h < 190 ? 'Teal' : h < 205 ? 'Cyan' : h < 255 ? 'Blue' : h < 290 ? 'Purple' : h < 345 ? 'Pink' : 'Red';
    return (l < 0.3 ? 'Dark ' : l > 0.72 ? 'Light ' : '') + base;
}

// ───────────────────────── analysis ─────────────────────────
const GENERIC_FONTS = new Set(['inherit', 'initial', 'unset', 'revert', 'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', '-apple-system', 'blinkmacsystemfont', 'emoji', 'math', 'fangsong']);

function topN(map, n) { return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n); }
const inc = (map, k, by = 1) => map.set(k, (map.get(k) || 0) + by);

function metaContent(html, attr, name) {
    const re = new RegExp(`<meta[^>]+${attr}\\s*=\\s*["']${name}["'][^>]*>`, 'i');
    const tag = (html.match(re) || [])[0];
    if (!tag) return '';
    return ((tag.match(/content\s*=\s*"([^"]*)"/i) || tag.match(/content\s*=\s*'([^']*)'/i) || [])[1] || '').trim();
}

function detectTech(html, css, headers) {
    const h = html.toLowerCase(), c = css.toLowerCase();
    const server = String(headers['server'] || '').toLowerCase();
    const found = [];
    const add = (name, cond) => { if (cond && !found.includes(name)) found.push(name); };
    add('Tailwind CSS', /cdn\.tailwindcss\.com|tailwindcss/.test(h) || /\.(?:sm|md|lg):[a-z-]+|--tw-[a-z-]+/.test(c));
    add('Bootstrap', /bootstrap(?:\.min)?\.(?:css|js)|bootstrap@|getbootstrap/.test(h) || /\.container-fluid|\.btn-primary/.test(c));
    add('Next.js', /__next_data__|\/_next\//.test(h));
    add('React', /data-reactroot|react(?:\.production|-dom)|__next_data__|id="root"/.test(h));
    add('Vue', /data-v-[0-9a-f]{6,8}|__vue__|vue(?:\.global|\.runtime|@)|id="app"/.test(h) || /\[data-v-[0-9a-f]{6,8}\]/.test(c));
    add('Nuxt', /__nuxt|\/_nuxt\//.test(h));
    add('Angular', /ng-version|<app-root/.test(h));
    add('Svelte', /svelte-[a-z0-9]{5,8}|\/_app\/immutable/.test(h + c));
    add('WordPress', /wp-content|wp-includes/.test(h));
    add('Shopify', /cdn\.shopify\.com|shopify/.test(h));
    add('Wix', /wixstatic|wix\.com/.test(h));
    add('Webflow', /webflow/.test(h));
    add('Framer', /framerusercontent|framer\.com/.test(h));
    add('jQuery', /jquery/.test(h));
    add('Font Awesome', /font-?awesome|fontawesome|fa-solid|\bfa-[a-z]+/.test(h + c));
    add('Material UI / MDC', /\.mui-|mdc-|material-ui|Mui[A-Z]/.test(html + css));
    add('Bulma', /bulma/.test(h));
    add('GSAP', /gsap/.test(h));
    add('AOS (animate on scroll)', /aos\.(?:js|css)|data-aos/.test(h));
    add('Animate.css', /animate\.(?:min\.)?css|animate__/.test(h + c));
    add('Three.js', /three(?:\.min)?\.js|three@/.test(h));
    add('Google Fonts', /fonts\.googleapis\.com/.test(h + c));
    add('Vercel', /vercel/.test(server) || !!headers['x-vercel-id']);
    add('Cloudflare', /cloudflare/.test(server) || !!headers['cf-ray']);
    add('Netlify', /netlify/.test(server) || !!headers['x-nf-request-id']);
    add('GitHub Pages', /github\.com/.test(server) || !!headers['x-github-request-id']);
    return found;
}

function analyze(html, cssFiles, headers = {}) {
    html = String(html || '');
    const inlineStyleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]);
    const styleAttrs = [...html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map(m => m[1]);
    const css = [...inlineStyleBlocks, ...cssFiles, styleAttrs.join(';\n')].join('\n').replace(/\/\*[\s\S]*?\*\//g, '');

    // basic info
    const title = ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim();
    const info = {
        title,
        description: metaContent(html, 'name', 'description') || metaContent(html, 'property', 'og:description'),
        themeColor: metaContent(html, 'name', 'theme-color'),
        ogImage: metaContent(html, 'property', 'og:image'),
        lang: ((html.match(/<html[^>]*\slang\s*=\s*["']([^"']+)["']/i) || [])[1] || ''),
        viewport: !!metaContent(html, 'name', 'viewport')
    };

    // colors
    const colors = collectColors(css);
    const themeHex = info.themeColor ? normColor(info.themeColor) : null;

    // css variables (sirf kaam ke naam / color values)
    const vars = new Map();
    for (const m of css.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;{}]+?)\s*(?:;|\})/g)) {
        const name = m[1], val = m[2].trim();
        if (vars.has(name) || val.length > 60 || /^var\(/.test(val)) continue;
        const interesting = /primary|secondary|accent|brand|bg|background|surface|text|foreground|font|radius|border|shadow|color|main|dark|light/i.test(name);
        if (interesting && !/^--tw-/.test(name)) vars.set(name, val);
    }

    // fonts
    const fontCounts = new Map();
    for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
        for (const raw of m[1].split(',').slice(0, 2)) {
            const name = raw.replace(/!important/i, '').replace(/["']/g, '').trim();
            if (!name || GENERIC_FONTS.has(name.toLowerCase()) || /^var\(|^--/.test(name) || name.length > 40) continue;
            inc(fontCounts, name);
        }
    }
    const fontFaces = new Set();
    for (const m of css.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*([^;}]+)/gi)) fontFaces.add(m[1].replace(/["']/g, '').trim());
    const gfonts = new Set();
    for (const m of (html + css).matchAll(/fonts\.googleapis\.com\/css2?\?([^"')\s>]+)/gi)) {
        for (const f of m[1].replace(/&amp;/g, '&').split('&').filter(x => x.startsWith('family='))) {
            gfonts.add(decodeURIComponent(f.slice(7).split(':')[0]).replace(/\+/g, ' '));
        }
    }

    // sizes / shape / effects
    const bodyBlock = (css.match(/(?:^|[}\s,])(?:html\s*,\s*)?body\s*\{([^}]*)\}/i) || [])[1] || '';
    const rootBlock = (css.match(/(?:^|[}\s,]):root\s*\{([^}]*)\}/i) || [])[1] || '';
    const pickProp = (block, prop) => ((block.match(new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;}]+)`, 'i')) || [])[1] || '').trim();
    const bodyBg = pickProp(bodyBlock, 'background(?:-color)?');
    const bodyColor = pickProp(bodyBlock, 'color');
    const bodySize = pickProp(bodyBlock, 'font-size') || pickProp(css.match(/(?:^|[}\s,])html\s*\{([^}]*)\}/i)?.[1] || '', 'font-size');
    const h1Size = ((css.match(/(?:^|[}\s,])h1\s*(?:,[^{]*)?\{[^}]*?font-size\s*:\s*([^;}]+)/i) || [])[1] || '').trim();

    const radii = new Map();
    for (const m of css.matchAll(/border-radius\s*:\s*([^;}]+)/gi)) inc(radii, m[1].trim().replace(/\s+/g, ' ').slice(0, 24));
    const shadows = css.match(/box-shadow\s*:/gi)?.length || 0;
    const shadowSample = ((css.match(/box-shadow\s*:\s*([^;}]+)/i) || [])[1] || '').trim().slice(0, 60);

    const fx = {
        gradients: (css.match(/(?:linear|radial|conic)-gradient\(/gi) || []).length,
        glass: /backdrop-filter\s*:\s*[^;]*blur/i.test(css),
        keyframes: (css.match(/@keyframes\s+[\w-]+/gi) || []).length,
        transitions: (css.match(/transition(?:-[a-z]+)?\s*:/gi) || []).length,
        darkMode: /prefers-color-scheme\s*:\s*dark|\.dark\b|\[data-theme=["']?dark/i.test(css),
        grid: (css.match(/display\s*:\s*grid/gi) || []).length,
        flex: (css.match(/display\s*:\s*(?:inline-)?flex/gi) || []).length,
        customProps: vars.size
    };

    const bp = new Set();
    for (const m of css.matchAll(/@media[^{]*\(\s*(?:max|min)-width\s*:\s*(\d{3,4})px/gi)) bp.add(parseInt(m[1], 10));

    return {
        info, colors, themeHex,
        vars: [...vars.entries()].slice(0, 12),
        fonts: topN(fontCounts, 5).map(([n]) => n),
        fontFaces: [...fontFaces].slice(0, 5),
        gfonts: [...gfonts].slice(0, 5),
        body: { bg: bodyBg.slice(0, 40), color: bodyColor.slice(0, 30), size: bodySize.slice(0, 16), h1: h1Size.slice(0, 20), rootHas: !!rootBlock },
        radii: topN(radii, 3).map(([v]) => v),
        shadows, shadowSample, fx,
        breakpoints: [...bp].sort((a, b) => a - b).slice(0, 8),
        tech: detectTech(html, css, headers),
        cssBytes: css.length
    };
}

// ───────────────────────── output ─────────────────────────
const boldMap = t => [...String(t).toUpperCase()].map(ch => {
    if (ch >= 'A' && ch <= 'Z') return String.fromCodePoint(0x1D400 + ch.charCodeAt(0) - 65);
    return ch;
}).join('');

function box(title, rows) {
    rows = rows.filter(Boolean);
    if (!rows.length) return '';
    const last = rows.length - 1;
    const lines = rows.map((r, i) => `${rows.length === 1 ? '┣╰⟡' : i === 0 ? '┣┬⟡' : i === last ? '┋╰⟡' : '┋├⟡'} ${r}`);
    return `╭━═❲ ${boldMap(title)}\n${lines.join('\n')}\n╰${'┉'.repeat(16)}❥`;
}

function buildReport(url, a) {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const parts = [];
    parts.push(`🎨 *WEBSITE DESIGN REPORT*\n🌐 ${host}${a.info.title ? `\n📝 ${a.info.title.slice(0, 80)}` : ''}`);

    const colorRows = [];
    if (a.themeHex) colorRows.push(`Theme color: *${a.themeHex.toUpperCase()}* (${colorName(a.themeHex)})`);
    a.colors.accents.forEach((c, i) => colorRows.push(`${i === 0 ? 'Main' : 'Accent'}: *${c.hex.toUpperCase()}* — ${colorName(c.hex)} (${c.n}x)`));
    a.colors.neutrals.forEach(c => colorRows.push(`Neutral: *${c.hex.toUpperCase()}* — ${colorName(c.hex)} (${c.n}x)`));
    if (a.body.bg) colorRows.push(`Body bg: ${a.body.bg}`);
    if (a.body.color) colorRows.push(`Text: ${a.body.color}`);
    parts.push(box('Colors', colorRows));

    const fonts = [...new Set([...a.fonts, ...a.gfonts, ...a.fontFaces])].slice(0, 6);
    const fontRows = [];
    if (fonts.length) fontRows.push(`Fonts: ${fonts.join(', ')}`);
    if (a.gfonts.length) fontRows.push(`Google Fonts: ${a.gfonts.join(', ')}`);
    if (a.body.size) fontRows.push(`Body size: ${a.body.size}`);
    if (a.body.h1) fontRows.push(`H1 size: ${a.body.h1}`);
    parts.push(box('Typography', fontRows));

    if (a.vars.length) parts.push(box('CSS Variables', a.vars.map(([k, v]) => `${k}: ${v}`)));

    const fx = a.fx;
    const styleRows = [];
    if (a.radii.length) styleRows.push(`Border radius: ${a.radii.join(' | ')}`);
    if (a.shadows) styleRows.push(`Shadows: ${a.shadows}${a.shadowSample ? ` (e.g. ${a.shadowSample})` : ''}`);
    if (fx.gradients) styleRows.push(`Gradients: ${fx.gradients}`);
    if (fx.glass) styleRows.push('Glass effect (backdrop blur): Yes');
    if (fx.keyframes) styleRows.push(`Animations: ${fx.keyframes} keyframes`);
    if (fx.transitions) styleRows.push(`Transitions: ${fx.transitions}`);
    styleRows.push(`Dark mode: ${fx.darkMode ? 'Yes' : 'Not found'}`);
    if (fx.grid || fx.flex) styleRows.push(`Layout: ${fx.flex ? `Flexbox (${fx.flex})` : ''}${fx.flex && fx.grid ? ' + ' : ''}${fx.grid ? `Grid (${fx.grid})` : ''}`);
    if (a.breakpoints.length) styleRows.push(`Breakpoints: ${a.breakpoints.map(x => x + 'px').join(', ')}`);
    styleRows.push(`Responsive meta: ${a.info.viewport ? 'Yes' : 'No'}`);
    parts.push(box('Style', styleRows));

    if (a.tech.length) parts.push(box('Tech', [a.tech.join(', ')]));

    let foot = `_Source: HTML + ${Math.round(a.cssBytes / 1024)}KB CSS_`;
    if (a.cssBytes < 800) foot += '\n_⚠️ Bahut kam CSS mila — ye site JS se styles banati hogi, isliye details adhuri ho sakti hain._';
    parts.push(foot);
    return parts.filter(Boolean).join('\n\n');
}

// palette image (sharp se; na chale to sirf text jayega)
function paletteSvg(host, a) {
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const list = [...a.colors.accents, ...a.colors.neutrals].slice(0, 12);
    if (!list.length) return null;
    const perRow = 4, W = 1000, pad = 40, gap = 20;
    const cw = (W - pad * 2 - gap * (perRow - 1)) / perRow, ch = 190;
    const rows = Math.ceil(list.length / perRow), H = 130 + rows * (ch + gap) + 20;
    const luminance = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return 0.299 * r + 0.587 * g + 0.114 * b; };
    let body = '';
    list.forEach((c, i) => {
        const x = pad + (i % perRow) * (cw + gap), y = 120 + Math.floor(i / perRow) * (ch + gap);
        const fg = luminance(c.hex) > 150 ? '#111111' : '#ffffff';
        body += `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="22" fill="${c.hex}" stroke="#ffffff" stroke-opacity=".25" stroke-width="2"/>` +
            `<text x="${x + cw / 2}" y="${y + ch / 2 + 6}" font-size="34" font-weight="bold" fill="${fg}" text-anchor="middle">${c.hex.toUpperCase()}</text>` +
            `<text x="${x + cw / 2}" y="${y + ch / 2 + 46}" font-size="22" fill="${fg}" fill-opacity=".85" text-anchor="middle">${esc(colorName(c.hex))}</text>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="36" fill="#14060d"/>` +
        `<g font-family="DejaVu Sans, Arial, Helvetica, sans-serif"><text x="${pad}" y="72" font-size="40" font-weight="bold" fill="#ffffff">${esc(host).slice(0, 40)}</text>` +
        `<text x="${pad}" y="104" font-size="22" fill="#ffb3be">Color palette</text>${body}</g></svg>`;
}

// ───────────────────────── command ─────────────────────────
const lastUse = new Map();

cmd({
    pattern: 'design',
    alias: ['webdesign', 'sitedesign', 'designinfo'],
    desc: 'Kisi bhi website ke design ki details (colors, fonts, style, tech)',
    use: '.design <link>',
    category: 'tools',
    react: '🎨',
    filename: __filename
}, async (conn, mek, m, { from, q, reply, sender }) => {
    const input = String(q || '').trim().split(/\s+/)[0];
    if (!input) {
        return reply(`🎨 *WEBSITE DESIGN*\n\nKisi bhi website ke design ki details nikalta hai: colors, fonts, style aur tech.\n\n📌 Use: ${P()}design https://example.com`);
    }

    const who = sender || m.sender || from;
    const now = Date.now();
    if (now - (lastUse.get(who) || 0) < COOLDOWN_MS) return reply('⏳ Thoda ruko, pichli request abhi chal rahi hai. 10 second baad dobara try karo.');
    lastUse.set(who, now);
    if (lastUse.size > 500) lastUse.delete(lastUse.keys().next().value);

    let target;
    try { target = parseUrl(input); } catch (e) { return reply(`❌ ${e.message}\n\nMisal: ${P()}design https://example.com`); }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});
        const page = await fetchText(target.href, MAX_HTML, 'html');
        if (!/<html|<head|<body|<!doctype|<div|<style|<link/i.test(page.text.slice(0, 5000))) {
            return reply('❌ Ye link HTML website ka nahi lag raha (shayad image / file / API hai).');
        }

        // linked stylesheets (pehle wo jin mein css/style naam ho), max 5
        const hrefs = [];
        for (const m2 of page.text.matchAll(/<link\b[^>]*>/gi)) {
            const tag = m2[0];
            if (!/rel\s*=\s*["']?(?:stylesheet|preload)/i.test(tag)) continue;
            if (/rel\s*=\s*["']?preload/i.test(tag) && !/as\s*=\s*["']?style/i.test(tag)) continue;
            const href = (tag.match(/href\s*=\s*["']([^"']+)["']/i) || [])[1];
            if (!href || /^data:/i.test(href)) continue;
            try { const abs = new URL(href.replace(/&amp;/g, '&'), page.url).href; if (!hrefs.includes(abs)) hrefs.push(abs); } catch (_) {}
        }
        const googleFontCss = hrefs.filter(h => /fonts\.googleapis\.com/i.test(h));
        const siteCss = hrefs.filter(h => !/fonts\.googleapis\.com/i.test(h)).slice(0, MAX_CSS_FILES);
        const cssTexts = [];
        const results = await Promise.allSettled(siteCss.map(h => fetchText(h, MAX_CSS, 'css')));
        for (const r of results) if (r.status === 'fulfilled') cssTexts.push(r.value.text);
        // Google Fonts link html mein hi counted hota hai (analyze html + css dono scan karta hai)
        const a = analyze(page.text + '\n' + googleFontCss.map(h => `<link href="${h}">`).join('\n'), cssTexts, page.headers);

        const report = buildReport(page.url, a);

        // palette image
        try {
            const svg = paletteSvg(new URL(page.url).hostname.replace(/^www\./, ''), a);
            if (svg) {
                const png = await require('sharp')(Buffer.from(svg)).png().toBuffer();
                await conn.sendMessage(from, { image: png, caption: `🎨 *${new URL(page.url).hostname}* — color palette` }, { quoted: mek });
            }
        } catch (e) { console.error('[design] palette skipped:', e.message); }

        await conn.sendMessage(from, { text: report }, { quoted: mek });
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
    } catch (e) {
        const msg = e && e.response ? `Site ne ${e.response.status} error diya.` : (e && e.code === 'ECONNABORTED' ? 'Site ne time par jawab nahi diya.' : (e && e.message) || 'Unknown error');
        return reply(`❌ Design details nahi mil sakin.\n${msg}`);
    }
});

module.exports = { analyze, buildReport, parseUrl, isPrivateIp, normColor, paletteSvg };
