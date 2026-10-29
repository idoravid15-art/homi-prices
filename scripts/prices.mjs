#!/usr/bin/env node
/* The chains' price files, fetched and boiled down to the basket.

     node scripts/prices.mjs discover [out.json]   candidates for each basket line
     node scripts/prices.mjs build <dir>           one small JSON per chain
       --skip shufersal       leave a chain to its own job: what is published is kept
       --only shufersal       build that chain alone, into a copy of what is published
       --minutes 45 --listing 8   how long the downloads, and one chain's listing, may take

   Runs in GitHub Actions (.github/workflows/prices.yml), not on a phone:
   the chains send no CORS header, the full files are megabytes per store,
   and the Cerberus host speaks FTP. What it writes is the basket's prices
   per store, a few hundred KB, which the app reads.

   `discover` reads two stores per chain and lists, for every basket line,
   the items its `find` rule catches, with how many chains carry each
   barcode. Barcodes are then chosen by hand into app/basket.js: a rule picks
   up a chocolate milk now and then, and a wrong barcode is a wrong price on
   somebody's phone.

   Everything fetched is public by law. Nothing here reads the database.
   Logs show file and store counts only. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parsePriceFile, parsePromoFile, parseStoresFile, parseFileName, latestByStore, readBytes, isPlainOffer
} from '../app/prices.js';
import { CHAINS, BASKET, pricesUrl, catalogUrl } from '../app/basket.js';

const run = promisify(execFile);
const CERBERUS = 'url.retail.publishedprices.co.il';

let LISTING_MINUTES = 8;

/* Where each chain publishes, and how its listing is read. */
const SOURCES = {
  '7290027600007': { kind: 'shufersal' },
  '7290058140886': { kind: 'cerberus', user: 'RamiLevi' },
  '7290803800003': { kind: 'cerberus', user: 'yohananof' },
  '7291059100008': { kind: 'cerberus', user: 'politzer' },
  '7290876100000': { kind: 'cerberus', user: 'freshmarket' },
  '7290103152017': { kind: 'cerberus', user: 'osherad' },
  '7290055700007': { kind: 'publishprice', base: 'https://prices.carrefour.co.il' }
};

async function get(url) {
  if (url.startsWith('ftp://')) {
    const { stdout } = await run('curl', ['-sS', '-m', '90', url], { encoding: 'buffer', maxBuffer: 512 << 20 });
    return stdout;
  }
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch {}
    await new Promise(r => setTimeout(r, 2000 * (i + 1)));
  }
  throw new Error('download failed');
}
const getText = async url => new TextDecoder().decode(await get(url));

/* [{ name, url }] of everything a chain lists right now. */
async function listing(chainId) {
  const s = SOURCES[chainId];
  if (s.kind === 'cerberus') {
    const { stdout } = await run('curl', ['-sS', '-m', '120', '--list-only', `ftp://${s.user}:@${CERBERUS}/`], { maxBuffer: 64 << 20 });
    return stdout.split(/\r?\n/).filter(Boolean).map(name => ({ name, url: `ftp://${s.user}:@${CERBERUS}/${name}` }));
  }
  if (s.kind === 'shufersal') {
    const out = new Map();
    /* Shufersal's listing once took the whole run on a slow morning; past
       this, the pages read so far are what there is. */
    const until = Date.now() + LISTING_MINUTES * 6e4;
    /* Stores first: the branch names are the small file, and a slow morning
       that ran out of time before reaching them left 334 Shufersal branches
       known only by number. */
    for (const cat of [5, 2, 4]) {
      /* Three pages at a time: each one is slow to come, not heavy, so
         waiting for them side by side is most of the time saved. A page
         that does not come is asked again, not taken as the end of the
         list: on a slow morning that cut Shufersal to one page. */
      let misses = 0, done = false;
      for (let page = 1; page <= 80 && !done; page += 3) {
        if (Date.now() > until) break;
        const pages = await Promise.all([page, page + 1, page + 2].map(n => {
          const url = `https://prices.shufersal.co.il/FileObject/UpdateCategory?catID=${cat}&page=${n}`;
          return getText(url).catch(() => getText(url)).catch(() => null);
        }));
        if (Date.now() > until) break;
        for (const html of pages) {
          if (html === null) { if (++misses > 2) done = true; continue; }
          const links = [...html.matchAll(/href="(https:\/\/[^"]+?\/([^/?"]+\.(?:gz|xml))\?[^"]*)"/g)];
          let added = 0;
          for (const [, url, name] of links) {
            if (!out.has(name)) { out.set(name, url.replace(/&amp;/g, '&')); added++; }
          }
          if (!added) { done = true; break; }
        }
      }
    }
    return [...out].map(([name, url]) => ({ name, url }));
  }
  if (s.kind === 'publishprice') {
    /* The page keeps the file list as JSON inside a script, for one dated
       folder; today's and yesterday's folders are read too. */
    const out = new Map();
    /* The root shows today's folder, named by the Israeli date, which fills
       store by store through the day; ?date= opens another day's (the page's
       own date picker does that), and yesterday's has every store. */
    const root = await getText(`${s.base}/`).catch(() => '');
    const today = (root.match(/const path = ['"]\.?\/?(\d{8})/) || [])[1];
    const days = today ? [today, new Date(Date.UTC(+today.slice(0, 4), +today.slice(4, 6) - 1, +today.slice(6) - 1)).toISOString().slice(0, 10).replace(/-/g, '')] : [];
    for (const q of ['', ...days.map(d => `?date=${d}`)]) {
      const html = q ? await getText(`${s.base}/${q}`).catch(() => '') : root;
      const path = (html.match(/const path = ['"]([^'"]*)['"]/) || [])[1] || '';
      const json = (html.match(/const files = (\[.*?\]);?\s*\n/) || [])[1];
      let files = [];
      try { files = JSON.parse(json); } catch {}
      for (const f of files) if (f && f.name) out.set(f.name, `${s.base}/${path ? path.replace(/^\.\//, '') + '/' : ''}${f.name}`);
    }
    return [...out].map(([name, url]) => ({ name, url }));
  }
  return [];
}

/* Newest stores file, and newest full price and promotions file per store,
   from the last two days only. */
function pickFiles(list) {
  const since = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
  const names = list.map(f => f.name);
  const url = new Map(list.map(f => [f.name, f.url]));
  const storesFile = names.filter(n => parseFileName(n)?.kind === 'stores')
    .sort((a, b) => parseFileName(b).stamp.localeCompare(parseFileName(a).stamp))[0];
  const prices = latestByStore(names, 'pricefull', since).map(f => ({ ...f, url: url.get(f.name) }));
  const promos = new Map(latestByStore(names, 'promofull', since).map(f => [f.storeId, url.get(f.name)]));
  return { storesUrl: storesFile && url.get(storesFile), prices, promos };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i).catch(e => ({ error: String(e.message || e) })); }
  }));
  return out;
}

const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

async function discover(outFile) {
  const found = {};   // lineId -> code -> { name, unit, qty, weighted, chains:Set, prices:[] }
  const report = {};
  for (const chain of CHAINS) {
    const list = await listing(chain.id).catch(() => []);
    const { prices } = pickFiles(list);
    const kinds = {};
    for (const f of list) { const k = parseFileName(f.name)?.kind || 'other'; (kinds[k] ||= []).push(f.name); }
    report[chain.key] = { listed: list.length, stores: prices.length,
      kinds: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, [v.length, ...v.sort().slice(-3)]])) };
    if (SOURCES[chain.id].kind === 'publishprice') {
      /* whole pages: the file list sits in a script near the end */
      const base = SOURCES[chain.id].base, root = await getText(base + '/').catch(() => '');
      const today = (root.match(/const path = ['"]\.?\/?(\d{8})/) || [])[1] || '';
      writeFileSync(outFile.replace(/[^/]+$/, `${chain.key}-root.head.html`), root);
      if (today) writeFileSync(outFile.replace(/[^/]+$/, `${chain.key}-day.head.html`), await getText(`${base}/?date=${today}`).catch(() => ''));
    }
    const sample = prices.slice(0, 3);
    for (const f of sample) {
      /* one file that will not come down is a gap in the list, not the end of it */
      let file;
      try { file = parsePriceFile(await readBytes(await get(f.url))); }
      catch { report[chain.key].failed = (report[chain.key].failed || 0) + 1; continue; }
      for (const line of BASKET) {
        const inc = new RegExp(line.find.inc), exc = line.find.exc ? new RegExp(line.find.exc) : null;
        for (const it of file.items) {
          if (!inc.test(it.name) || (exc && exc.test(it.name))) continue;
          if (line.find.weighted && !it.weighted) continue;
          const key = it.barcode ? it.code : `${chain.key}:${it.code}`;
          const at = ((found[line.id] ||= {})[key] ||= { name: it.name, unit: it.unit, qty: it.qty, weighted: it.weighted, chains: new Set(), prices: [] });
          at.chains.add(chain.key);
          at.prices.push(it.price);
        }
      }
    }
  }
  const out = { report, lines: {} };
  for (const line of BASKET) {
    out.lines[line.id] = Object.entries(found[line.id] || {})
      .map(([code, c]) => ({ code, name: c.name, unit: c.unit, qty: c.qty, w: c.weighted ? 1 : 0, chains: [...c.chains], price: median(c.prices) }))
      .sort((a, b) => b.chains.length - a.chains.length || a.code.localeCompare(b.code))
      .slice(0, line.kg ? 40 : 25);
  }
  writeFileSync(outFile, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(report));
}

/* A store's price for each basket line: its cheapest of the line's codes. */
function pricesFor(file, chain) {
  const byCode = new Map(file.items.map(i => [i.code, i.price]));
  const out = {};
  for (const line of BASKET) {
    const codes = [...(line.codes || []), ...((line.local || {})[chain.id] || [])];
    let best = null;
    for (const c of codes) { const p = byCode.get(c); if (p && (best === null || p < best)) best = p; }
    if (best !== null) out[line.id] = best;
  }
  return out;
}

/* Promotions on a line's codes that anyone can get, today, as the chain
   words them: "2 ב־100" is a rule, not a price, so it is shown, not summed. */
function promosFor(file, chain, now) {
  const out = {};
  const lineOfCode = new Map();
  for (const line of BASKET) for (const c of [...(line.codes || []), ...((line.local || {})[chain.id] || [])]) lineOfCode.set(c, line.id);
  for (const p of file.promos) {
    if (!isPlainOffer(p, now)) continue;
    for (const it of p.items) {
      const id = lineOfCode.get(it.code);
      if (id && !out[id]) out[id] = [p.desc, p.end.slice(0, 10)];
    }
  }
  return out;
}

/* A slow morning at the chains once kept a build going past the job's limit,
   and nothing was published. Past this, stores not yet read are left for
   tomorrow and what was read goes out. */
let BUILD_MINUTES = 45;

/* A branch whose file did not come today keeps what it had, for this long:
   Shufersal's listing seldom reaches every branch in one morning, and a few
   mornings together do. A branch that closed drops out after it. */
const CARRY_DAYS = 3;

/* The chain's whole shelf, for pricing a list item the basket does not
   know. One price per product, the middle of what the chain's stores ask,
   since a file per store would be hundreds of megabytes a day. A product
   carried by fewer than one store in twenty is left out: it is a branch's
   own, not the chain's. Rows are arrays to keep the file small:
   [code, name, price, price per unit or 0, unit, share of stores, weighed]. */
function addToShelf(shelf, file) {
  for (const it of file.items) {
    let x = shelf.get(it.code);
    /* Copies, not slices: a string cut from the file keeps the whole file
       alive, and a store's file is tens of megabytes. Keeping slices of every
       store's file once ran the build out of memory. */
    if (!x) shelf.set(own(it.code), x = { n: own(it.name), w: it.weighted ? 1 : 0, u: own(it.unit), ps: [], ups: [] });
    x.ps.push(it.price);
    if (it.unitPrice) x.ups.push(it.unitPrice);
  }
}
const own = str => (' ' + (str || '')).slice(1);
const mid = xs => { const s = xs.sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const r2 = n => Math.round(n * 100) / 100;
function shelfFile(chain, shelf, stores, built) {
  const least = stores >= 20 ? stores * 0.05 : 1;
  const items = [];
  for (const [code, x] of shelf) {
    if (x.ps.length < least || !x.n) continue;
    items.push([code, x.n, r2(mid(x.ps)), r2(mid(x.ups)), x.u || '', r2(x.ps.length / stores), x.w]);
  }
  return { v: 1, chain: chain.id, built, stores, items };
}

async function build(dir, { only = [], skip = [] } = {}) {
  const deadline = Date.now() + BUILD_MINUTES * 6e4;
  mkdirSync(dir, { recursive: true });
  const now = new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 19);   // Israel, near enough for a date
  /* --only builds into a copy of what is published, so the other chains'
     entries stay as they are */
  const was = only.length ? (() => { try { return JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')); } catch { return null; } })() : null;
  const index = { built: new Date().toISOString(), chains: (was?.chains || []).filter(c => !only.includes(c.key)) };
  for (const chain of CHAINS) {
    if (only.length && !only.includes(chain.key)) continue;
    if (skip.includes(chain.key)) {
      /* its own job builds it later; until then what is published stays */
      const kept = await getText(pricesUrl(chain.id)).then(JSON.parse).catch(() => null);
      const cat = await getText(catalogUrl(chain.id)).catch(() => null);
      if (cat) writeFileSync(join(dir, `catalog-${chain.key}.json`), cat);
      if (kept && kept.chain === chain.id && kept.stores) {
        writeFileSync(join(dir, `${chain.key}.json`), JSON.stringify(kept));
        index.chains.push({ id: chain.id, key: chain.key, stores: Object.keys(kept.stores).length, kept: kept.built });
      }
      console.log(`${chain.key}: left to its own job${kept ? ', published prices kept' : ''}`);
      continue;
    }
    const list = await listing(chain.id).catch(() => []);
    const { storesUrl, prices, promos } = pickFiles(list);
    const stores = storesUrl ? parseStoresFile(await readBytes(await get(storesUrl))).stores : [];
    const info = new Map(stores.map(s => [s.storeId, s]));
    /* A branch with no name today keeps yesterday's, so it is never only a number */
    const before = await getText(pricesUrl(chain.id)).then(JSON.parse).catch(() => null);
    const data = { v: 1, chain: chain.id, name: chain.name, built: index.built, stores: {} };
    const shelf = new Map();
    let read = 0;
    const results = await pool(prices, 8, async f => {
      if (Date.now() > deadline) return { error: 'late' };
      const file = parsePriceFile(await readBytes(await get(f.url)));
      addToShelf(shelf, file);
      read++;
      const p = pricesFor(file, chain);
      if (!Object.keys(p).length) return null;
      let promo = {};
      if (promos.get(f.storeId)) {
        promo = await get(promos.get(f.storeId)).then(readBytes).then(t => promosFor(parsePromoFile(t), chain, now)).catch(() => ({}));
      }
      return { id: f.storeId, p, promo };
    });
    let failed = 0;
    for (const r of results) {
      if (!r) continue;
      if (r.error) { failed++; continue; }
      const s = info.get(r.id) || {};
      const was = before?.stores?.[r.id] || {};
      data.stores[r.id] = { n: s.name || was.n || '', a: s.address || was.a || '', c: s.city || was.c || '', p: r.p };
      if (Object.keys(r.promo).length) data.stores[r.id].m = r.promo;
    }
    let carried = 0;
    for (const [id, st] of Object.entries(before?.stores || {})) {
      const at = st.d || before.built;
      if (data.stores[id] || !at || Date.now() - Date.parse(at) > CARRY_DAYS * 864e5) continue;
      data.stores[id] = { ...st, d: at };
      carried++;
    }
    const count = Object.keys(data.stores).length;
    console.log(`${chain.key}: listed ${list.length}, price files ${prices.length}, stores priced ${count - carried}, failed ${failed}, kept from before ${carried}`);
    const cat = read ? shelfFile(chain, shelf, read, index.built) : await getText(catalogUrl(chain.id)).then(JSON.parse).catch(() => null);
    if (cat && cat.items?.length) {
      writeFileSync(join(dir, `catalog-${chain.key}.json`), JSON.stringify(cat));
      console.log(`${chain.key}: catalog of ${cat.items.length} products${read ? '' : ', kept from before'}`);
    }
    if (count) {
      writeFileSync(join(dir, `${chain.key}.json`), JSON.stringify(data));
      index.chains.push({ id: chain.id, key: chain.key, stores: count });
    } else {
      /* Nothing from this chain today: keep what is published, with its own
         date, rather than take the chain away from families who picked it. */
      const kept = await getText(pricesUrl(chain.id)).then(JSON.parse).catch(() => null);
      if (kept && kept.chain === chain.id && kept.stores) {
        writeFileSync(join(dir, `${chain.key}.json`), JSON.stringify(kept));
        index.chains.push({ id: chain.id, key: chain.key, stores: Object.keys(kept.stores).length, kept: kept.built });
        console.log(`${chain.key}: kept the last published prices, from ${kept.built}`);
      }
    }
  }
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index));
}

const [mode, arg, ...rest] = process.argv.slice(2);
const flag = name => { const i = rest.indexOf('--' + name); return i < 0 ? null : rest[i + 1]; };
const keys = name => (flag(name) || '').split(',').filter(Boolean);
if (flag('minutes')) BUILD_MINUTES = Number(flag('minutes'));
if (flag('listing')) LISTING_MINUTES = Number(flag('listing'));
if (mode === 'discover') await discover(arg || 'discover.json');
else if (mode === 'build') await build(arg || 'out', { only: keys('only'), skip: keys('skip') });
else { console.error('usage: prices.mjs discover [out.json] | build <dir>'); process.exit(2); }
