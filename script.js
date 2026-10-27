'use strict';
/* MedVault: all data stays in this browser (localStorage). No network calls. */
const KEY = 'medvault:v1', SCHEMA = 1;
const DEFAULT_CATS = ['Pain relief','Allergy','Cold and cough','Digestive health','Antibiotics','Vitamins and supplements','Skin care','Chronic conditions','Other'];
// [key, label, control, group]
const FIELDS = [
  ['name','Medicine name (required)','text','Basics'],['generic','Generic name','text','Basics'],['brand','Brand name','text','Basics'],
  ['category','Category (a label only)','cat','Basics'],['ingredients','Active ingredient(s)','text','Basics'],['route','Route of administration (e.g. oral, topical)','text','Basics'],
  ['uses','What is it used for?','area','Use'],['conditions','Conditions or symptoms it is commonly used to treat','area','Use'],['how','How does it work?','area','Use'],
  ['strength','Dosage forms and strengths','area','Dosage'],['dosage','General dosage information (from a verified source)','area','Dosage'],['missed','If a dose is missed','area','Dosage'],
  ['common','Common side effects','area','Safety'],['serious','Serious side effects and warning signs','area','Safety'],['contra','Contraindications (when not to use)','area','Safety'],
  ['precautions','Precautions and warnings','area','Safety'],['interactions','Interactions with other medicines','area','Safety'],['foodInt','Food, drink or alcohol interactions','area','Safety'],
  ['pregnancy','Pregnancy and breastfeeding','area','Safety'],['overdose','Overdose and emergency guidance','area','Safety'],
  ['storage','Storage instructions','area','Other'],['instructions',"Doctor's or pharmacist's instructions",'area','Other'],
  ['notes','Personal notes (paste full details from reliable sources here)','notes','Other'],
  ['source','Source of information or reference URL','text','Source'],['reviewed','Date last reviewed','date','Source']
];
const LABEL = Object.fromEntries(FIELDS.map(f => [f[0], f[1].replace(/ \(.*\)$/, '')]));
const SECTIONS = [
  ['What it is used for',['uses','conditions']],['How it works',['how']],['Dosage and strength',['strength','route','dosage','missed']],
  ['Common side effects',['common']],['Serious side effects and warning signs',['serious']],['Warnings and precautions',['contra','precautions']],
  ['Interactions',['interactions','foodInt']],['Pregnancy and breastfeeding',['pregnancy']],['Storage',['storage']],
  ['Overdose and emergency guidance',['overdose']],["Doctor's or pharmacist's instructions",['instructions']],['Personal notes',['notes']]
];
const SEARCH_KEYS = ['name','generic','brand','ingredients','uses','conditions','category','notes'];

let S = { schema: SCHEMA, meds: [], cats: [...DEFAULT_CATS], recent: [], theme: 'auto', lastExport: 0 };
const UI = { q: '', cat: '', fav: false, sort: 'name', view: 'home', id: null };

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sig = m => [m.name, m.generic, m.brand].map(norm).join('|');
const find = id => S.meds.find(m => m.id === id);
function safeUrl(u) { try { const x = new URL(u.trim()); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } }
function fmtDate(t) { return t ? new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''; }

function clean(m) { // coerce any object into a safe medicine record
  const o = {};
  for (const f of FIELDS) o[f[0]] = typeof m[f[0]] === 'string' ? m[f[0]].slice(0, 20000) : '';
  o.tags = Array.isArray(m.tags) ? m.tags.map(t => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 30) : [];
  o.fav = !!m.fav; o.verified = !!m.verified;
  o.id = typeof m.id === 'string' && m.id ? m.id.slice(0, 40) : uid();
  o.added = Number(m.added) || Date.now(); o.updated = Number(m.updated) || o.added; o.viewed = Number(m.viewed) || 0;
  return o;
}

/* ---------- storage ---------- */
function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.meds)) throw new Error('bad shape');
    S.meds = d.meds.filter(m => m && typeof m.name === 'string').map(clean);
    if (Array.isArray(d.cats) && d.cats.length) S.cats = d.cats.map(String);
    S.recent = (Array.isArray(d.recent) ? d.recent : []).filter(i => find(i)).slice(0, 8);
    S.theme = ['light', 'dark', 'auto'].includes(d.theme) ? d.theme : 'auto';
    S.lastExport = Number(d.lastExport) || 0;
  } catch (e) {
    try { if (raw) localStorage.setItem(KEY + ':corrupt', raw); } catch {}
    toast('Saved data could not be read. A copy was kept aside; import a backup if needed.', 'err');
  }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
  catch { toast('Could not save: storage is full or blocked. Export a backup now.', 'err'); return false; }
}

/* ---------- feedback ---------- */
function toast(msg, type, action) {
  const box = $('#toast');
  const t = h('div', { class: 'toast ' + (type || '') }, h('span', {}, msg));
  if (action) t.append(h('button', { type: 'button', onclick: () => { action.fn(); t.remove(); } }, action.label));
  box.append(t);
  setTimeout(() => t.remove(), action ? 8000 : 4500);
}
function ask(title, msg, buttons) {
  return new Promise(res => {
    const d = h('dialog', {}, h('h2', {}, title), h('p', {}, msg),
      h('div', { class: 'row' }, buttons.map(([label, val, cls]) =>
        h('button', { class: 'btn ' + (cls || ''), type: 'button', onclick: () => { res(val); d.close(); } }, label))));
    d.addEventListener('close', () => { res(null); d.remove(); });
    document.body.append(d); d.showModal();
  });
}

/* ---------- text rendering (always as text, never innerHTML) ---------- */
function hl(text, q) {
  const toks = (q || '').trim().split(/\s+/).filter(Boolean).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!toks.length) return [text];
  return String(text).split(new RegExp('(' + toks.join('|') + ')', 'gi')).map((p, i) => i % 2 ? h('mark', {}, p) : p);
}
function fmt(text) { // keeps line breaks; lines starting with "- " or "* " become bullets
  const out = []; let list = null;
  for (const line of String(text).split('\n')) {
    const b = line.match(/^\s*[-*\u2022]\s+(.*)$/);
    if (b) { if (!list) { list = h('ul', { class: 'fmt' }); out.push(list); } list.append(h('li', {}, b[1])); }
    else { list = null; out.push(h('p', { class: 'txt' }, line)); }
  }
  return out;
}

/* ---------- search ---------- */
function haystack(m) { return norm(SEARCH_KEYS.map(k => m[k]).join(' ') + ' ' + m.tags.join(' ')); }
function results() {
  const toks = norm(UI.q).split(' ').filter(Boolean);
  let r = S.meds.filter(m => (!UI.cat || m.category === UI.cat) && (!UI.fav || m.fav));
  if (toks.length) { r = r.filter(m => { const hs = haystack(m); return toks.every(t => hs.includes(t)); });
    r.sort((a, b) => (norm(b.name).startsWith(toks[0]) | 0) - (norm(a.name).startsWith(toks[0]) | 0) || a.name.localeCompare(b.name)); return r; }
  const s = { name: (a, b) => a.name.localeCompare(b.name), added: (a, b) => b.added - a.added, viewed: (a, b) => b.viewed - a.viewed }[UI.sort];
  return r.sort(s);
}
function suggestions() {
  const q = norm(UI.q); if (!q) return [];
  const set = new Set();
  for (const m of S.meds) for (const v of [m.name, m.generic, m.brand]) if (v && norm(v).includes(q)) set.add(v);
  return [...set].slice(0, 6);
}

/* ---------- views ---------- */
function go(v, id, replace) {
  UI.view = v; UI.id = id || null;
  history[replace ? 'replaceState' : 'pushState']({ v, id: UI.id }, '');
  render();
}
function render() {
  const m = $('#main'); m.replaceChildren();
  if (UI.view === 'detail' && !find(UI.id)) UI.view = 'home';
  if (UI.view === 'form' && UI.id && !find(UI.id)) UI.id = null;
  ({ home: viewHome, detail: viewDetail, form: viewForm, tools: viewTools }[UI.view] || viewHome)(m);
  document.querySelectorAll('.nav button').forEach(b => b.setAttribute('aria-current', b.dataset.v === UI.view && !(UI.view === 'form' && UI.id) ? 'page' : 'false'));
  window.scrollTo(0, 0);
}

function card(m, q) {
  const sum = (m.uses || m.conditions || m.notes || '').replace(/\s+/g, ' ').slice(0, 140);
  return h('button', { class: 'item', type: 'button', onclick: () => open(m.id) },
    h('b', {}, m.fav ? '\u2605 ' : '', hl(m.name, q)),
    h('span', { class: 'meta' }, hl([m.generic, m.brand].filter(Boolean).join(' / ') || 'No generic or brand name', q)),
    h('span', {}, h('span', { class: 'tag' }, m.category || 'Uncategorised'), m.verified ? h('span', { class: 'tag clay' }, 'Marked as source-checked') : null),
    h('span', { class: 'sum' }, sum ? hl(sum + (sum.length >= 140 ? '\u2026' : ''), q) : 'No summary saved yet.'));
}
function open(id) { const m = find(id); if (!m) return; m.viewed = Date.now(); S.recent = [id, ...S.recent.filter(x => x !== id)].slice(0, 8); save(); go('detail', id); }

function viewHome(m) {
  const n = S.meds.length;
  m.append(h('section', { class: 'hero' }, h('h1', {}, 'MedVault'), h('p', { class: 'sub' }, 'Your personal medicine reference library'),
    h('p', { class: 'local' }, 'Saved on this device only. ' + n + (n === 1 ? ' medicine' : ' medicines') + ' in your library.')));
  if (n && Date.now() - S.lastExport > 30 * 864e5)
    m.append(h('div', { class: 'banner' }, 'Your data lives only in this browser. Clearing browser data or switching phone removes it. ', h('button', { class: 'btn sm', type: 'button', onclick: () => go('tools') }, 'Back up now')));
  if (!n) {
    m.append(h('div', { class: 'card empty' }, h('h2', {}, 'Your library is empty'), h('p', {}, 'Add a medicine and type or paste its details from a leaflet, pharmacist or trusted site. MedVault never fills in medical facts for you.'),
      h('div', { class: 'row', style: 'justify-content:center' }, h('button', { class: 'btn primary', type: 'button', onclick: () => go('form') }, 'Add your first medicine'), h('button', { class: 'btn', type: 'button', onclick: () => go('tools') }, 'Import a backup'))));
    return;
  }
  const dl = h('datalist', { id: 'sugg' });
  const inp = h('input', { id: 'q', type: 'search', placeholder: 'Search name, brand, ingredient, use', autocomplete: 'off', enterkeyhint: 'search', list: 'sugg', 'aria-label': 'Search medicines', value: UI.q });
  const res = h('div', { 'aria-live': 'polite' });
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by category' });
  const clear = h('button', { class: 'btn', type: 'button', 'aria-label': 'Clear search', onclick: () => { UI.q = ''; inp.value = ''; upd(); inp.focus(); } }, 'Clear');
  m.append(h('div', { class: 'searchbar', role: 'search' }, inp, dl, clear), chips);
  const sortSel = h('select', { 'aria-label': 'Sort medicines', style: 'width:auto', onchange: e => { UI.sort = e.target.value; upd(); } },
    [['name', 'Sort: name'], ['added', 'Sort: date added'], ['viewed', 'Sort: recently viewed']].map(([v, l]) => h('option', { value: v, selected: UI.sort === v }, l)));
  m.append(h('div', { class: 'row', style: 'margin-bottom:10px' }, h('button', { class: 'btn', type: 'button', id: 'favBtn', 'aria-pressed': String(UI.fav), onclick: () => { UI.fav = !UI.fav; upd(); } }, 'Favorites only'), sortSel), res);
  inp.addEventListener('input', () => { UI.q = inp.value; upd(); });
  function upd() {
    chips.replaceChildren(...['', ...S.cats].map(c => h('button', { class: 'btn', type: 'button', 'aria-pressed': String(UI.cat === c), onclick: () => { UI.cat = c; upd(); } }, c || 'All categories')));
    $('#favBtn').setAttribute('aria-pressed', String(UI.fav));
    dl.replaceChildren(...suggestions().map(s => h('option', { value: s })));
    res.replaceChildren();
    const browsing = !UI.q && !UI.cat && !UI.fav;
    if (browsing) {
      const secs = [['Recently viewed', S.recent.map(find).filter(Boolean).slice(0, 4)], ['Recently added', [...S.meds].sort((a, b) => b.added - a.added).slice(0, 4)], ['Favorites', S.meds.filter(x => x.fav).slice(0, 6)]];
      for (const [t, arr] of secs) if (arr.length) res.append(h('h2', { class: 'sec' }, t), h('div', { class: 'list' }, arr.map(x => card(x))));
      res.append(h('h2', { class: 'sec' }, 'All medicines'));
    }
    const r = results();
    if (!r.length) res.append(h('div', { class: 'card empty' }, h('h2', {}, 'No medicines found'), h('p', {}, UI.q ? 'Nothing matches \u201c' + UI.q + '\u201d. Try a shorter name, the brand or generic name, or an ingredient.' : 'Nothing matches these filters.'),
      h('button', { class: 'btn', type: 'button', onclick: () => { UI.q = ''; UI.cat = ''; UI.fav = false; inp.value = ''; upd(); } }, 'Reset search and filters')));
    else res.append(h('p', { class: 'local' }, r.length + (r.length === 1 ? ' result' : ' results')), h('div', { class: 'list' }, r.map(x => card(x, UI.q))));
  }
  upd();
}

function plainText(m) {
  const L = [m.name.toUpperCase()];
  for (const k of ['generic', 'brand', 'category', 'ingredients']) if (m[k]) L.push(LABEL[k] + ': ' + m[k]);
  for (const [t, keys] of SECTIONS) for (const k of keys) if (m[k]) L.push('', t + (keys.length > 1 ? ' - ' + LABEL[k] : '') + ':', m[k]);
  if (m.tags.length) L.push('', 'Tags: ' + m.tags.join(', '));
  if (m.source) L.push('', 'Source: ' + m.source);
  if (m.reviewed) L.push('Last reviewed: ' + m.reviewed);
  L.push('', m.verified ? 'Marked by the owner as checked against a source.' : 'Entered by the owner. Not verified.', 'Reference only; not medical advice. Check the official leaflet and ask a doctor or pharmacist.');
  return L.join('\n');
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied to clipboard.'); }
  catch { const a = h('textarea', { style: 'position:fixed;opacity:0' }); a.value = t; document.body.append(a); a.select();
    try { document.execCommand('copy'); toast('Copied to clipboard.'); } catch { toast('Copy failed on this browser.', 'err'); } a.remove(); }
}

function viewDetail(root) {
  const m = find(UI.id);
  const acts = h('div', { class: 'row noprint', style: 'margin:12px 0' },
    h('button', { class: 'btn', type: 'button', onclick: () => history.length > 1 && UI.view === 'detail' ? history.back() : go('home') }, 'Back to results'),
    h('button', { class: 'btn', type: 'button', 'aria-pressed': String(m.fav), onclick: e => { m.fav = !m.fav; save(); e.target.setAttribute('aria-pressed', String(m.fav)); e.target.textContent = m.fav ? 'Remove favorite' : 'Add favorite'; } }, m.fav ? 'Remove favorite' : 'Add favorite'),
    h('button', { class: 'btn', type: 'button', onclick: () => go('form', m.id) }, 'Edit'),
    h('button', { class: 'btn', type: 'button', onclick: () => copyText(plainText(m)) }, 'Copy'),
    navigator.share ? h('button', { class: 'btn', type: 'button', onclick: () => navigator.share({ title: m.name, text: plainText(m) }).catch(() => {}) }, 'Share') : null,
    h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, 'Print or save PDF'),
    h('button', { class: 'btn danger', type: 'button', onclick: () => del(m) }, 'Delete'));
  const head = h('div', { class: 'card' }, h('h1', {}, m.name),
    m.generic ? h('p', {}, h('b', {}, 'Generic: '), m.generic) : null, m.brand ? h('p', {}, h('b', {}, 'Brand: '), m.brand) : null,
    m.ingredients ? h('p', {}, h('b', {}, 'Active ingredients: '), m.ingredients) : null,
    h('p', {}, h('span', { class: 'tag' }, m.category || 'Uncategorised'), m.tags.map(t => h('span', { class: 'tag' }, '#' + t))));
  root.append(acts, head);
  const shown = SECTIONS.filter(([, keys]) => keys.some(k => m[k]));
  const ctl = h('div', { class: 'row noprint', style: 'margin-bottom:10px' },
    h('button', { class: 'btn sm', type: 'button', onclick: () => root.querySelectorAll('details').forEach(d => d.open = true) }, 'Expand all'),
    h('button', { class: 'btn sm', type: 'button', onclick: () => root.querySelectorAll('details').forEach(d => d.open = false) }, 'Collapse all'));
  root.append(h('div', { class: 'emergency' }, h('b', {}, 'Emergency: '), 'If you suspect an overdose or a severe reaction (trouble breathing, swelling of the face or throat, fainting), call your local emergency number or poison control right away.'));
  if (!shown.length) root.append(h('div', { class: 'card empty' }, h('p', {}, 'No details saved yet.'), h('button', { class: 'btn primary', type: 'button', onclick: () => go('form', m.id) }, 'Add details')));
  else root.append(ctl);
  shown.forEach(([t, keys], i) => root.append(h('details', { open: i < 3 }, h('summary', {}, t),
    h('div', {}, keys.filter(k => m[k]).map(k => [keys.length > 1 ? h('h4', {}, LABEL[k]) : null, fmt(m[k])])))));
  const url = m.source && safeUrl(m.source);
  root.append(h('details', { open: true }, h('summary', {}, 'Source and review'), h('div', {},
    h('h4', {}, 'Source'), m.source ? (url ? h('p', {}, h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, m.source)) : h('p', { class: 'txt' }, m.source)) : h('p', {}, 'No source saved.'),
    h('h4', {}, 'Date last reviewed'), h('p', {}, m.reviewed || 'Not recorded'),
    h('h4', {}, 'Status'), h('p', {}, m.verified ? 'You marked this entry as checked against a reliable source. MedVault cannot confirm that.' : 'Entered by you. Not verified.'),
    h('p', { class: 'local' }, 'Added ' + fmtDate(m.added) + (m.updated !== m.added ? ', edited ' + fmtDate(m.updated) : '')))));
}
window.addEventListener('beforeprint', () => document.querySelectorAll('details').forEach(d => d.open = true));

function del(m) {
  ask('Delete ' + m.name + '?', 'This removes the entry from this device. You can undo right after.', [['Delete', true, 'danger'], ['Keep it', null, 'primary']]).then(ok => {
    if (!ok) return;
    const i = S.meds.indexOf(m), rec = S.recent.slice(); S.meds.splice(i, 1); S.recent = S.recent.filter(x => x !== m.id); save(); go('home', null, true);
    toast('Deleted ' + m.name + '.', '', { label: 'Undo', fn: () => { S.meds.splice(Math.min(i, S.meds.length), 0, m); S.recent = rec; save(); if (UI.view === 'home') render(); toast('Restored.'); } });
  });
}

function viewForm(root) {
  const ex = find(UI.id), d = ex || clean({});
  const form = h('form', { novalidate: true });
  root.append(h('h1', { style: 'margin:8px 0 12px' }, ex ? 'Edit medicine' : 'Add medicine'), h('p', { class: 'local' }, 'Only the name is required. Enter facts from a leaflet, pharmacist or trusted source; leave unknown fields empty.'), form);
  const groups = [...new Set(FIELDS.map(f => f[3]))];
  for (const g of groups) {
    const fs = h('fieldset', {}, h('legend', {}, g));
    for (const [k, label, type] of FIELDS.filter(f => f[3] === g)) {
      const id = 'f-' + k; fs.append(h('label', { for: id }, label));
      let c;
      if (type === 'cat') { const cats = S.cats.includes(d.category) || !d.category ? S.cats : [...S.cats, d.category];
        c = h('select', { id, name: k }, h('option', { value: '' }, 'No category'), cats.map(x => h('option', { value: x, selected: d.category === x }, x))); }
      else if (type === 'text') c = h('input', { id, name: k, type: 'text', value: d[k], maxlength: 300, autocomplete: 'off', required: k === 'name', 'aria-required': k === 'name' ? 'true' : null, autocapitalize: k === 'name' ? 'words' : null });
      else if (type === 'date') c = h('input', { id, name: k, type: 'date', value: d[k] });
      else { c = h('textarea', { id, name: k, rows: type === 'notes' ? 14 : 4 }); c.value = d[k]; }
      fs.append(c);
      if (k === 'name') fs.append(h('div', { id: 'nameErr', class: 'err-text', hidden: true, role: 'alert' }, 'Enter a medicine name.'));
    }
    if (g === 'Other') fs.append(h('label', { for: 'f-tags' }, 'Tags (separate with commas)'), h('input', { id: 'f-tags', name: 'tags', type: 'text', value: d.tags.join(', '), autocomplete: 'off' }));
    if (g === 'Source') fs.append(h('label', { class: 'check', for: 'f-verified' }, h('input', { id: 'f-verified', name: 'verified', type: 'checkbox', checked: d.verified }), 'I checked these details against a reliable source (leaflet, pharmacist, official site).'));
    form.append(fs);
  }
  form.append(h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit' }, ex ? 'Save changes' : 'Save medicine'), h('button', { class: 'btn', type: 'button', onclick: () => history.back() }, 'Cancel')));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = {}; for (const f of FIELDS) v[f[0]] = form.elements[f[0]].value.trim();
    if (!v.name) { $('#nameErr').hidden = false; $('#f-name').focus(); return; }
    if (S.meds.some(x => x.id !== d.id && norm(x.name) === norm(v.name))) {
      const c = await ask('Possible duplicate', 'A medicine named \u201c' + v.name + '\u201d is already saved. Save a separate entry anyway?', [['Save anyway', true], ['Go back', null, 'primary']]);
      if (!c) return;
    }
    Object.assign(d, v, { tags: form.elements.tags.value.split(',').map(t => t.trim()).filter(Boolean).slice(0, 30), verified: form.elements.verified.checked, updated: Date.now() });
    if (!ex) S.meds.push(d);
    if (v.category && !S.cats.includes(v.category)) S.cats.push(v.category);
    if (save()) { toast(ex ? 'Changes saved.' : 'Medicine saved.'); go('detail', d.id, true); }
  });
}

/* ---------- backup, import, categories ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify({ app: 'MedVault', schema: SCHEMA, exported: new Date().toISOString(), cats: S.cats, medicines: S.meds }, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: 'medvault-backup-' + new Date().toISOString().slice(0, 10) + '.json' });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  S.lastExport = Date.now(); save(); toast('Backup downloaded. Keep the file somewhere safe.');
}
async function importFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { return toast('That file is not valid JSON.', 'err'); }
  const arr = Array.isArray(data) ? data : data && data.medicines;
  if (!Array.isArray(arr)) return toast('No medicine list found in this file.', 'err');
  const items = arr.filter(x => x && typeof x === 'object' && typeof x.name === 'string' && x.name.trim()).map(clean);
  if (!items.length) return toast('No valid medicines found in this file.', 'err');
  const known = new Set(S.meds.map(sig)), fresh = items.filter(x => !known.has(sig(x))), bad = arr.length - items.length;
  const c = await ask('Import ' + items.length + ' medicine' + (items.length === 1 ? '' : 's') + '?',
    fresh.length + ' new, ' + (items.length - fresh.length) + ' already saved' + (bad ? ', ' + bad + ' invalid skipped' : '') + '. Merge adds only new entries. Replace erases everything currently saved first.',
    [['Merge (safe)', 'merge', 'primary'], ['Replace all', 'replace'], ['Cancel', null]]);
  if (!c) return;
  if (c === 'replace' && !(await ask('Replace your whole library?', 'Your ' + S.meds.length + ' current entries will be deleted. Export a backup first if unsure.', [['Replace', true, 'danger'], ['Cancel', null, 'primary']]))) return;
  const old = S.meds.slice(); let add = c === 'merge' ? fresh : items;
  if (c === 'replace') S.meds = [];
  const ids = new Set(S.meds.map(x => x.id)); add.forEach(x => { if (ids.has(x.id)) x.id = uid(); ids.add(x.id); });
  S.meds.push(...add);
  const cats = [...(Array.isArray(data.cats) ? data.cats.map(String) : []), ...add.map(x => x.category).filter(Boolean)];
  cats.forEach(x => { if (!S.cats.includes(x)) S.cats.push(x); });
  S.recent = S.recent.filter(find);
  if (save()) { toast('Imported ' + add.length + ' medicine' + (add.length === 1 ? '' : 's') + '.'); render(); } else { S.meds = old; }
}
function viewTools(root) {
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', id: 'imp', onchange: e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); } });
  root.append(h('h1', { style: 'margin:8px 0 12px' }, 'Backup and settings'),
    h('div', { class: 'card' }, h('h2', {}, 'Back up your library'), h('p', {}, 'Medicines are stored only in this browser on this device. Clearing browser data, changing browser or switching phone can erase them. Export regularly. Last export: ' + (S.lastExport ? fmtDate(S.lastExport) : 'never') + '.'),
      h('button', { class: 'btn primary', type: 'button', onclick: exportData }, 'Export JSON backup (' + S.meds.length + ')')),
    h('div', { class: 'card' }, h('h2', {}, 'Restore from backup'), h('p', {}, 'Pick a MedVault JSON file. You will see a preview before anything changes.'), h('label', { for: 'imp' }, 'Backup file'), fileIn));
  const catBox = h('div', { class: 'card' }, h('h2', {}, 'Categories'), h('p', {}, 'Categories are only labels for organising. They do not say a medicine suits any condition.'));
  S.cats.forEach((c, i) => catBox.append(h('div', { class: 'row', style: 'margin-bottom:8px;flex-wrap:nowrap' },
    h('input', { value: c, 'aria-label': 'Category name', maxlength: 60, onchange: e => { const nv = e.target.value.trim(); if (!nv || S.cats.includes(nv)) { e.target.value = c; return; } S.meds.forEach(m => { if (m.category === c) m.category = nv; }); S.cats[i] = nv; save(); render(); } }),
    h('button', { class: 'btn danger', type: 'button', 'aria-label': 'Remove category ' + c, onclick: () => { S.meds.forEach(m => { if (m.category === c) m.category = ''; }); S.cats.splice(i, 1); if (UI.cat === c) UI.cat = ''; save(); render(); } }, 'Remove'))));
  const nc = h('input', { placeholder: 'New category', 'aria-label': 'New category', maxlength: 60 });
  catBox.append(h('div', { class: 'row', style: 'flex-wrap:nowrap' }, nc, h('button', { class: 'btn', type: 'button', onclick: () => { const v = nc.value.trim(); if (v && !S.cats.includes(v)) { S.cats.push(v); save(); render(); } } }, 'Add')));
  root.append(catBox, h('div', { class: 'card' }, h('h2', {}, 'Privacy'), h('p', {}, 'No account, no server, no analytics. Nothing you type leaves this device unless you export or share it yourself.'),
    h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (await ask('Erase all data?', 'This deletes every medicine saved in this browser.', [['Erase everything', true, 'danger'], ['Cancel', null, 'primary']])) { S.meds = []; S.recent = []; save(); toast('All medicines erased.'); render(); } } }, 'Erase all data on this device')));
}

/* ---------- theme and boot ---------- */
function applyTheme() { if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = S.theme; }
function isDark() { return S.theme === 'dark' || (S.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches); }
document.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b && (b.closest('.nav') || b.closest('.top'))) { UI.id = null; go(b.dataset.v); } });
$('#themeBtn').addEventListener('click', () => { S.theme = isDark() ? 'light' : 'dark'; applyTheme(); save(); });
addEventListener('popstate', e => { const s = e.state || { v: 'home' }; UI.view = s.v; UI.id = s.id || null; render(); });
load(); applyTheme(); history.replaceState({ v: 'home' }, ''); render();
