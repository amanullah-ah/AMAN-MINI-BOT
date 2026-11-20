// lib/catpanel.js — category overrides (rename / move / delete / custom) — data/categories.json
// Asli (original) category har command par `baseCategory` me rehti hai; owner/admin ki pabandi hamesha usi par chalti hai,
// isliye category ka naam badalne se koi command public nahi hota.

const fs = require('fs');
const path = require('path');

const FILE = process.env.CATEGORIES_FILE || path.join(__dirname, '..', 'data', 'categories.json');
const PROTECTED_NAMES = ['panel'];             // panel khud kabhi delete/rename/move nahi hota
const NAME_RE = /^[a-z0-9_-]{2,20}$/;

function load() {
    let d = {};
    try { d = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}; } catch (_) {}
    return {
        renames: d.renames || {},   // { baseCategory: { name } }
        custom: d.custom || {},     // { name: {} }
        moves: d.moves || {},       // { commandPattern: categoryName }
        deleted: Array.isArray(d.deleted) ? d.deleted : [],   // [baseCategory]
        icons: d.icons || {}        // { displayName: '🎓' }
    };
}

function save(d) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
}

const registry = () => require('../arslan').commands;
const dispName = (d, base) => (d.renames[base] && d.renames[base].name) || base;

// Menu / gating ke liye jo bases kabhi delete nahi ho sakte (panel + jis category me .menu hai)
function protectedBases() {
    const out = new Set(PROTECTED_NAMES);
    const menu = registry().find(c => c.pattern === 'menu');
    if (menu) out.add(menu.baseCategory || menu.category);
    return out;
}

function apply() {
    const d = load();
    const deleted = new Set(d.deleted);
    const keep = protectedBases();
    for (const c of registry()) {
        if (!c.pattern) continue;
        if (c.baseCategory === undefined) c.baseCategory = c.category;
        if (c._origDont === undefined) c._origDont = !!c.dontAddCommandList;
        const base = c.baseCategory;
        const mv = d.moves[c.pattern];
        c.category = mv || dispName(d, base);
        c.catDeleted = !mv && deleted.has(base) && !keep.has(base);
        c.dontAddCommandList = c._origDont || c.catDeleted;
    }
    try {   // custom icons menu me dikhane ke liye
        const icons = require('../plugins/carousel-menu').CATEGORY_ICONS;
        if (icons) for (const [k, v] of Object.entries(d.icons)) icons[k] = v;
    } catch (_) {}
}

function bases() {
    const set = new Set();
    for (const c of registry()) if (c.pattern && c.baseCategory !== undefined) set.add(c.baseCategory);
    return [...set];
}

// Saari categories ka haal
function info() {
    const d = load();
    const cmds = registry().filter(c => c.pattern);
    const live = new Map();
    for (const c of cmds) {
        if (c.catDeleted) continue;
        live.set(c.category, (live.get(c.category) || 0) + 1);
    }
    for (const n of Object.keys(d.custom)) if (!live.has(n)) live.set(n, 0);
    const list = [...live.entries()].map(([name, count]) => ({ name, count, custom: !!d.custom[name], icon: d.icons[name] || '' }))
        .sort((a, b) => a.name.localeCompare(b.name));
    const deleted = d.deleted.map(base => ({
        base, name: dispName(d, base),
        count: cmds.filter(c => c.baseCategory === base && !d.moves[c.pattern]).length
    }));
    return { d, list, deleted };
}

// display naam -> { kind: 'base'|'custom', base? }
function resolve(name) {
    const d = load();
    const n = String(name || '').trim().toLowerCase();
    const base = bases().find(b => dispName(d, b) === n && !d.deleted.includes(b));
    if (base !== undefined) return { kind: 'base', base, name: n };
    if (d.custom[n]) return { kind: 'custom', name: n };
    return null;
}

const nameTaken = (name) => {
    const { list, deleted } = info();
    return list.some(c => c.name === name) || deleted.some(c => c.name === name);
};

module.exports = { load, save, apply, info, resolve, nameTaken, bases, dispName, protectedBases, NAME_RE, PROTECTED_NAMES };
