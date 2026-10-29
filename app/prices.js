/* ==========================================================
   the chains' price files, read into one shape

   Since 2015 every large chain publishes, per branch, the price of every
   item it sells (Price Transparency regulations under the Food Law): a
   stores file, a full price file and a promotions file, as XML, usually
   gzipped. This reads the stores file and the full price file into plain
   objects that look the same whichever chain wrote them.

   They are almost the same format and not quite. What each chain was seen
   writing, in the samples under tests/price-samples:
     - Rami Levy writes the item's name as ItemNm; the others ItemName.
     - Shufersal and Carrefour write ManufactureName; Rami Levy and
       Yohananof ManufacturerName.
     - The ids are ChainID/StoreID at Shufersal and Carrefour, ChainId/StoreId
       at Rami Levy and Yohananof, and "039", "39" and "001" for one store
       across a file name, a price file and a stores file.
     - Dates come as "2025-01-19 16:03:55" and as "2026-10-12T12:08:58.000".
     - Stores files are UTF-16 at Rami Levy, Yohananof, Carrefour and Osher Ad,
       UTF-8 with a BOM at Shufersal. Some open tags carry attributes.
     - A code is not always a barcode: Rami Levy sells a tomato as item 100.
   So tags are looked up by every name a chain was seen using, case aside, and
   ids are read as numbers, so a store in one file is the same store in another.

   Pure, except readBytes, which un-gzips with DecompressionStream (browser,
   Worker and Node alike). Nothing here fetches: where the files come from is
   somebody else's job, because a phone cannot read them directly (the chains
   send no CORS header).
   ========================================================== */

/* Every name a chain was seen giving a field, lower-cased. */
const ITEM_TAGS = {
  code:      ['itemcode'],
  name:      ['itemname', 'itemnm', 'manufactureitemdescription', 'manufactureritemdescription'],
  maker:     ['manufacturename', 'manufacturername'],
  price:     ['itemprice'],
  unitPrice: ['unitofmeasureprice'],
  unit:      ['unitofmeasure'],
  qty:       ['quantity'],
  weighted:  ['bisweighted', 'blsweighted'],
  updated:   ['priceupdatetime', 'priceupdatedate']
};

/* What a chain writes when it does not know, which is not a value. */
const UNKNOWN = new Set(['לא ידוע', 'unknown', '']);

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function unescape(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return ENTITY[e.toLowerCase()] ?? m;
    });
}

function clean(s) {
  const t = unescape(s).replace(/\s+/g, ' ').trim();
  return UNKNOWN.has(t) ? '' : t;
}

/* The leaf children of one block, keyed by lower-cased tag. An empty tag,
   <ItemStatus/> or <ItemStatus />, is there and empty. */
function leaves(block) {
  const out = {};
  const re = /<([A-Za-z_][\w.-]*)(?:\s[^>]*)?\/>|<([A-Za-z_][\w.-]*)(?:\s[^>]*)?>([^<]*(?:<!\[CDATA\[[\s\S]*?\]\]>[^<]*)*)<\/\2\s*>/g;
  let m;
  while ((m = re.exec(block))) {
    const tag = (m[1] || m[2]).toLowerCase();
    if (!(tag in out)) out[tag] = m[1] ? '' : m[3];
  }
  return out;
}

function pick(fields, names) {
  for (const n of names) if (n in fields) return fields[n];
  return undefined;
}

/* One tag's text anywhere in the head of a file, before the list starts. */
function headField(head, names) {
  return pick(leaves(head), names);
}

/* "039", "39" and "001" are ids, and the same store is written all three
   ways; as numbers they meet. Something that is not a number stays as it is. */
export function normId(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return /^\d+$/.test(s) ? String(Number(s)) : s;
}

function num(v) {
  const s = String(v ?? '').trim().replace(/,/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* Both date shapes the chains write, as "YYYY-MM-DDTHH:MM:SS". */
export function normDate(v) {
  const m = String(v ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return '';
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || '00'}`;
}

/* A barcode is 8 to 14 digits (EAN-8 up to GTIN-14). Anything shorter is the
   chain's own number for something it weighs or bakes, and means nothing at
   the next chain. */
export function isBarcode(code) {
  return /^\d{8,14}$/.test(String(code ?? ''));
}

/* The full price file of one store.
   Returns { chainId, subChainId, storeId, items }, each item
   { code, barcode, name, maker, price, unitPrice, unit, qty, weighted, updated }.
   An item without a code or a price above zero is left out: it cannot be
   compared and would only be a wrong number on a phone. A file cut short
   (a sample, a broken download) gives the items it has whole. */
export function parsePriceFile(text) {
  const src = String(text ?? '');
  const open = src.search(/<Items[\s>]/i);
  const head = open >= 0 ? src.slice(0, open) : src.slice(0, 2000);
  const out = {
    chainId: normId(headField(head, ['chainid'])),
    subChainId: normId(headField(head, ['subchainid'])),
    storeId: normId(headField(head, ['storeid'])),
    items: []
  };
  const re = /<Item(?:\s[^>]*)?>([\s\S]*?)<\/Item\s*>/gi;
  let m;
  while ((m = re.exec(src))) {
    const f = leaves(m[1]);
    const code = clean(pick(f, ITEM_TAGS.code) ?? '');
    const price = num(pick(f, ITEM_TAGS.price));
    if (!code || !(price > 0)) continue;
    const unitPrice = num(pick(f, ITEM_TAGS.unitPrice));
    out.items.push({
      code,
      barcode: isBarcode(code),
      name: clean(pick(f, ITEM_TAGS.name) ?? ''),
      maker: clean(pick(f, ITEM_TAGS.maker) ?? ''),
      price,
      unitPrice: unitPrice > 0 ? unitPrice : null,
      unit: clean(pick(f, ITEM_TAGS.unit) ?? ''),
      qty: num(pick(f, ITEM_TAGS.qty)),
      weighted: String(pick(f, ITEM_TAGS.weighted) ?? '').trim() === '1',
      updated: normDate(pick(f, ITEM_TAGS.updated))
    });
  }
  return out;
}

/* The stores file of one chain.
   Returns { chainId, chainName, stores }, each store
   { subChainId, storeId, name, address, city, zip }. City is the code the
   chains use (Jerusalem is 3000), not a name.
   Stores are read in document order with the last sub-chain id seen, rather
   than sub-chain by sub-chain, so a file cut short still gives what it has. */
export function parseStoresFile(text) {
  const src = String(text ?? '');
  const open = src.search(/<(SubChains|Stores)[\s>]/i);
  const head = open >= 0 ? src.slice(0, open) : src.slice(0, 2000);
  const out = {
    chainId: normId(headField(head, ['chainid'])),
    chainName: clean(headField(head, ['chainname']) ?? ''),
    stores: []
  };
  const re = /<SubChainId(?:\s[^>]*)?>([^<]*)<\/SubChainId\s*>|<Store(?:\s[^>]*)?>([\s\S]*?)<\/Store\s*>/gi;
  let sub = '';
  let m;
  while ((m = re.exec(src))) {
    if (m[1] !== undefined) { sub = normId(m[1]); continue; }
    const f = leaves(m[2]);
    const storeId = normId(pick(f, ['storeid']));
    if (!storeId) continue;
    out.stores.push({
      subChainId: normId(pick(f, ['subchainid'])) || sub,
      storeId,
      name: clean(pick(f, ['storename']) ?? ''),
      address: clean(pick(f, ['address']) ?? ''),
      city: clean(pick(f, ['city']) ?? ''),
      zip: clean(pick(f, ['zipcode']) ?? '')
    });
  }
  return out;
}

/* The full promotions file of one store.
   Returns { chainId, storeId, promos }, each promo
   { id, desc, start, end, club, items: [{ code, minQty, total }] }.
   A promotion is a rule ("2 for 100", "1.9 kg for 61.75"), not a price, so
   it is kept as the chain states it: `total` is what minQty of the item
   costs under it. `club` is true when only a club's members get it; the
   chains write the club as "0", "0 - כלל הלקוחות" or a club's number, and
   0 is everyone. Items are found anywhere inside a promotion, since some
   chains group them and some do not. */
export function parsePromoFile(text) {
  const src = String(text ?? '');
  const open = src.search(/<Promotions[\s>]/i);
  const head = open >= 0 ? src.slice(0, open) : src.slice(0, 2000);
  const out = {
    chainId: normId(headField(head, ['chainid'])),
    storeId: normId(headField(head, ['storeid'])),
    promos: []
  };
  const re = /<Promotion(?:\s[^>]*)?>([\s\S]*?)<\/Promotion\s*>/gi;
  let m;
  while ((m = re.exec(src))) {
    const body = m[1];
    const cut = body.search(/<(Groups|PromotionItems)[\s>]/i);
    const f = leaves(cut >= 0 ? body.slice(0, cut) : body);
    const items = [];
    const ire = /<PromotionItem(?:\s[^>]*)?>([\s\S]*?)<\/PromotionItem\s*>/gi;
    let im;
    while ((im = ire.exec(body))) {
      const g = leaves(im[1]);
      const code = clean(pick(g, ['itemcode']) ?? '');
      if (!code) continue;
      const minQty = num(pick(g, ['minqty']));
      items.push({ code, minQty: minQty > 0 ? minQty : null, total: num(pick(g, ['discountedprice'])) });
    }
    const club = String(pick(f, ['clubid', 'clubids']) ?? '').match(/\d+/);
    out.promos.push({
      id: clean(pick(f, ['promotionid']) ?? ''),
      desc: clean(pick(f, ['promotiondescription']) ?? ''),
      start: normDate(pick(f, ['promotionstartdatetime', 'promotionstartdate'])),
      end: normDate(pick(f, ['promotionenddatetime', 'promotionenddate'])),
      club: !!club && Number(club[0]) !== 0,
      items
    });
  }
  return out;
}

/* Whether a promotion is one a shopper gets by buying: open to everyone,
   running now, and not a coupon, a card's deal or a gift. The chains list
   all of those as promotions ("ע. סיבוס קופון 50ש"ח מתנה" runs to 2031),
   and a family cannot act on them at the shelf. `now` is
   "YYYY-MM-DDTHH:MM:SS"; a promotion still running in a year is a standing
   arrangement, not an offer. */
const NOT_AN_OFFER = /קופון|סיבוס|מתנה|כרטיס|אשראי|מועדון|תו |שובר|חבר/;
export function isPlainOffer(p, now) {
  if (!p || p.club || !p.desc || NOT_AN_OFFER.test(p.desc)) return false;
  if (p.start && p.start > now) return false;
  if (p.end && p.end < now) return false;
  const yearOn = String(Number(now.slice(0, 4)) + 1) + now.slice(4);
  return !(p.end && p.end > yearOn);
}

/* A published file's name, read.
   PriceFull7290027600007-001-001-20261014-121701.gz  (chain-sub-store-date-time)
   pricefull7290058140886-039-202610140515.gz         (chain-store-datetime, older)
   Stores7290058140886-000-20261014-050500.xml
   Returns { kind, chainId, subChainId, storeId, stamp } or null; kind is
   lower-case (pricefull, promofull, price, promo, stores) and stamp is
   YYYYMMDDHHMMSS, so stamps compare as strings. */
export function parseFileName(name) {
  const m = String(name ?? '').match(/^(pricefull|promofull|price|promo|stores)(\d{13})-([\d-]+?)(?:\.(?:gz|xml|zip))?$/i);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const parts = m[3].split('-');
  const stampOf = (date, time = '') => (date + time).padEnd(14, '0').slice(0, 14);
  if (kind === 'stores') {
    const date = parts.find(p => p.length >= 8) || '';
    const time = parts[parts.indexOf(date) + 1] || '';
    return { kind, chainId: m[2], subChainId: '', storeId: '', stamp: stampOf(date, time) };
  }
  if (parts.length >= 4) {
    return { kind, chainId: m[2], subChainId: normId(parts[0]), storeId: normId(parts[1]), stamp: stampOf(parts[2], parts[3]) };
  }
  if (parts.length === 2) {
    return { kind, chainId: m[2], subChainId: '', storeId: normId(parts[0]), stamp: stampOf(parts[1]) };
  }
  return null;
}

/* From a listing, the newest file of one kind for each store. A listing
   keeps days of history and the odd file from years ago, so `since`
   (YYYYMMDD) drops what is older than that. */
export function latestByStore(names, kind = 'pricefull', since = '') {
  const best = new Map();
  for (const name of names || []) {
    const f = parseFileName(name);
    if (!f || f.kind !== kind) continue;
    if (since && f.stamp < String(since).padEnd(14, '0')) continue;
    const had = best.get(f.storeId);
    if (!had || f.stamp > had.stamp) best.set(f.storeId, { ...f, name });
  }
  return [...best.values()].sort((a, b) => Number(a.storeId) - Number(b.storeId) || a.storeId.localeCompare(b.storeId));
}

/* Bytes as the chains send them, as text: UTF-16 when it says so (a BOM) or
   looks it (a zero in every second byte), UTF-8 otherwise. TextDecoder drops
   the BOM, so the text starts at the first tag. */
export function decodeText(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b);
  if (b.length > 3 && b[1] === 0 && b[3] === 0 && b[0] !== 0) return new TextDecoder('utf-16le').decode(b);
  return new TextDecoder('utf-8').decode(b);
}

/* A downloaded file, gzipped or not, as text. */
export async function readBytes(bytes) {
  let b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b[0] === 0x1f && b[1] === 0x8b) {
    const stream = new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'));
    b = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return decodeText(b);
}
