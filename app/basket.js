/* ==========================================================
   the shopping basket, priced at the chains

   A household's list says "חלב", and a chain sells forty things called milk.
   This is the bridge: a fixed basket of what families buy most, each line
   with the words a list writes it in and the items that count as it at the
   chains. A list is priced by the lines it shares with the basket, so the
   number it shows is a comparison between chains on the same things, not a
   receipt, and says how many of the list's items it covers.

   How a line knows its items:
     - `codes` are barcodes, the same at every chain, chosen by reading the
       candidates the chains' own files offered (scripts/prices.mjs discover).
       A store's price for the line is its cheapest of them: brands stand in
       for each other, a family takes the one on the shelf.
     - `local` is for what a chain weighs and labels itself (a tomato is item
       100 at Rami Levy); those codes mean nothing at the next chain, so they
       are kept per chain.
     - `find` is how the candidates were looked for, kept so the next look
       finds the same kind of thing. It is never used to price.
   A line with no codes yet is skipped when pricing: an empty line is better
   than a wrong one.

   Pure. The prices come from the data the daily build writes
   (scripts/prices.mjs); this only reads them.
   ========================================================== */
import { normItem } from '../parser/shopping.js';

/* The chains that are read, by the id they publish under. */
/* Shufersal's site answers GitHub's runners slowly, so it is built by a job of
   its own after the others (.github/workflows/prices.yml), and a branch it did
   not reach one morning keeps what it had for a few days. */
export const CHAINS = Object.freeze([
  { id: '7290027600007', key: 'shufersal', name: 'שופרסל' },
  { id: '7290058140886', key: 'ramilevy',  name: 'רמי לוי' },
  { id: '7290803800003', key: 'yohananof', name: 'יוחננוף' },
  { id: '7290055700007', key: 'carrefour', name: 'קרפור' },
  /* On the Cerberus host like Rami Levy; scripts/price-probe.mjs found them
     answering GitHub's runners in seconds. Osher Ad publishes prices for two
     branches only, which is what it offers. They have no per-chain codes yet,
     so the basket's shared barcodes are all they are priced by. */
  { id: '7291059100008', key: 'politzer',    name: 'פוליצר' },
  { id: '7290876100000', key: 'freshmarket', name: 'פרש מרקט' },
  { id: '7290103152017', key: 'osherad',     name: 'אושר עד' }
]);
export const CHAIN_BY_ID = Object.fromEntries(CHAINS.map(c => [c.id, c]));

/* words: how a list writes it, through normItem (finals folded, lower case).
   A list item is the line when it is one of the words, or starts with one
   followed by a space, and has none of the `not` words in it.
   kg: priced by the kilo, as the chains price what they weigh. */
/* The four chains' ids, short, for the per-chain codes below. */
const S = '7290027600007', R = '7290058140886', Y = '7290803800003', C = '7290055700007';

export const BASKET = Object.freeze([
  { id: 'milk', label: 'חלב 3% ליטר', words: ['חלב', 'חלב 3', 'חלב טרי'], not: ['שקד', 'סויה', 'שיבולת', 'אורז', 'קוקוס', 'שוקו', 'אבקה', 'עמיד'],
    find: { inc: 'חלב.*3%', exc: 'שוקו|עמיד|סויה|שקד|שיבולת|אורז|לקטוז|אבקה|מועשר|קפה|משקה|מעדן' }, codes: ['7290004131074', '7290000042015', '7290000522319'] },
  { id: 'eggs', label: 'ביצים 12', words: ['ביצים', 'ביצה', 'תבנית ביצים'], not: ['שוקולד', 'הפתעה'],
    find: { inc: 'ביצים', exc: 'שוקולד|הפתעה|קינדר|פסטה|אטריות|אבקת|סלט|חביתה|קרמבו' }, codes: ['742259241895', '742259241901', '7290001201596'] },
  { id: 'bread', label: 'לחם אחיד פרוס 750 גרם', words: ['לחם', 'לחם אחיד', 'לחם לבן'], not: ['מלא', 'שיפון', 'כוסמין', 'פירורי', 'דגנים'],
    find: { inc: 'לחם (אחיד|לבן)', exc: 'פירורי|קלוי|מלא' }, codes: ['7290000574035'] },
  { id: 'cottage', label: 'קוטג׳ 5% 250 גרם', words: ['קוטג', 'גבינת קוטג'],
    find: { inc: "קוטג'|קוטג׳", exc: 'עוגה|ממרח' }, codes: ['7290000041445', '7290004127329'] },
  { id: 'whitecheese', label: 'גבינה לבנה 5% 250 גרם', words: ['גבינה לבנה', 'גבינה לבנה 5'],
    find: { inc: 'גבינה לבנה', exc: 'עוגה|בורקס|מאפה' }, codes: ['7290000048185', '7290000474502', '7290000047621'] },
  { id: 'yellowcheese', label: 'עמק פרוס 28% 200 גרם', words: ['גבינה צהובה', 'צהובה', 'עמק'],
    find: { inc: 'גבינה צהובה|עמק', exc: 'בורקס|מאפה|פיצה|טוסט|מגורר' }, codes: ['7290004122270', '7290000057088'] },
  { id: 'butter', label: 'חמאה תנובה 200 גרם', words: ['חמאה'], not: ['בוטנ', 'ממרח'],
    find: { inc: '^חמאה', exc: 'בוטנים|ממרח|עוגי|קקאו|מלוחה' }, codes: ['7290116932033'] },
  { id: 'sugar', label: 'סוכר לבן ק״ג', words: ['סוכר', 'סוכר לבן'], not: ['חום', 'דמררה', 'אבקת', 'קנים', 'וניל'],
    find: { inc: '^סוכר', exc: 'חום|דמררה|ענבים|וניל|אבקת|קנים|כוכב|מוסקובדו|מחליף' }, codes: ['7290000211503'] },
  { id: 'flour', label: 'קמח לבן ק״ג', words: ['קמח', 'קמח לבן'], not: ['מלא', 'תופח', 'כוסמין', 'תירס', 'מצה'],
    find: { inc: '^קמח', exc: 'תופח|מלא|כוסמין|תירס|מצה|אורז|שקד|תפו|חומוס|ללא גלוטן' }, codes: ['7290003107216', '7290016144031', '7290100701331'] },
  { id: 'rice', label: 'אורז ק״ג', words: ['אורז', 'אורז לבן', 'אורז פרסי'], not: ['פריכיות', 'קמח', 'מלא'],
    find: { inc: '^אורז', exc: 'פריכיות|קמח|עוגי|חטיף|משקה|תבשיל|מוקפץ|מלא|פראי|פודינג' }, codes: ['7290000211985', '7290000211442', '7290015603638'] },
  { id: 'pasta', label: 'פסטה אסם 500 גרם', words: ['פסטה', 'ספגטי', 'פנה', 'פוזילי'], not: ['רוטב'],
    find: { inc: 'ספגטי|פסטה|פנה|פוזילי', exc: 'רוטב|מוכנה|ארוחה|קפואה|סלט|מלא' }, codes: ['7290000060880', '7290000060248', '7290107871990', '7290000060828'] },
  { id: 'oil', label: 'שמן קנולה ליטר', words: ['שמן', 'שמן קנולה', 'שמן חמניות'], not: ['זית', 'תרסיס', 'שומשום'],
    find: { inc: 'שמן (קנולה|חמניות|סויה)', exc: 'תרסיס|ספריי' }, codes: ['7290000144474', '7290002374312', '7290002692393'] },
  { id: 'oliveoil', label: 'שמן זית 750 מ״ל', words: ['שמן זית'],
    find: { inc: 'שמן זית', exc: 'תרסיס|ספריי|טונה|סבון' }, codes: ['7290003427154', '7290010429554', '7290011593087'] },
  { id: 'salt', label: 'מלח ק״ג', words: ['מלח', 'מלח שולחן'], not: ['לימון', 'ים', 'גס', 'הימלאיה'],
    find: { inc: '^מלח', exc: 'לימון|הימלאיה|ים|גס|מלפפון' }, codes: ['7290000523804', '7290004064297'] },
  { id: 'tahini', label: 'טחינה גולמית 500 גרם', words: ['טחינה', 'טחינה גולמית'], not: ['חלבה', 'מוכנה', 'סלט'],
    find: { inc: '^טחינה|טחינה גולמית', exc: 'חלבה|עוגי|מוכנה|סלט|ממרח' }, codes: ['7290001216040', '7290000112220'] },
  { id: 'tuna', label: 'טונה 4×160 גרם', words: ['טונה', 'טונה בשמן'], not: ['סלט', 'חתול'],
    find: { inc: 'טונה', exc: 'סלט|פסטה|חתול|כלב|ממרח|פיצה' }, codes: ['7290005287251', '7290015039246', '7290015039338', '7290108504699'] },
  { id: 'coffee', label: 'קפה נמס 200 גרם', words: ['קפה', 'נס', 'נס קפה', 'קפה נמס'], not: ['קפסול', 'שחור', 'טורקי', 'פולי', 'קר'],
    find: { inc: 'נמס|נס קפה|נסקפה', exc: 'קפסול|משקה|עוגה|קר|מקציף|ליקר|שוקו' }, codes: ['7290000176420', '7290000061764'] },
  { id: 'tea', label: 'תה ויסוצקי 25 שקיקים', words: ['תה', 'תה ירוק'], not: ['קר', 'בקבוק'],
    find: { inc: '^תה ', exc: 'קר|משקה|בקבוק|כוס' }, codes: ['7290000345260'] },
  { id: 'cornflakes', label: 'קורנפלקס אלופים 850 גרם', words: ['קורנפלקס', 'דגני בוקר'],
    find: { inc: 'קורנפלקס', exc: 'חטיף|עוגי|שוקולד' }, codes: ['7290112494351'] },
  { id: 'ketchup', label: 'קטשופ אסם 750 גרם', words: ['קטשופ', 'קטשופ'],
    find: { inc: 'קטשופ', exc: 'צ.?יפס|ביסלי|חטיף' }, codes: ['7290000072623'] },
  { id: 'mayo', label: 'מיונז תלמה 500 גרם', words: ['מיונז'],
    find: { inc: 'מיונז', exc: 'סלט|טונה|רוטב' }, codes: ['7290000111186'] },
  { id: 'toiletpaper', label: 'נייר טואלט 32 גלילים', words: ['נייר טואלט', 'טואלט'],
    find: { inc: 'נייר טואלט', exc: 'לח|מחזיק' }, codes: ['7290000262031', '7290000187938'] },
  { id: 'papertowels', label: 'מגבות נייר ניקול 6', words: ['מגבות נייר', 'נייר סופג', 'נייר מגבת'],
    find: { inc: 'מגבות נייר|נייר סופג|מגבת נייר', exc: 'מחזיק|לח' }, codes: ['7290000188355'] },
  { id: 'dishsoap', label: 'נוזל כלים פיירי 900 מ״ל', words: ['סבון כלים', 'נוזל כלים', 'פיירי'],
    find: { inc: 'סבון כלים|נוזל (לניקוי )?כלים|פיירי', exc: 'מדיח|טבליות|ספוג' }, codes: ['8001090184375', '8001090184412'] },
  { id: 'laundry', label: 'אבקת כביסה מקסימה 2.5 ק״ג', words: ['גל כביסה', 'ג ל כביסה', 'אבקת כביסה', 'כביסה', 'נוזל כביסה'], not: ['מרכך'],
    find: { inc: "ג'ל כביסה|ג׳ל כביסה|אבקת כביסה|נוזל כביסה", exc: 'מרכך|כתמים|סל' }, codes: ['7290000295367', '7290005425202', '7290005425196', '7290012116537'] },
  { id: 'bleach', label: 'אקונומיקה 4 ליטר', words: ['אקונומיקה'],
    find: { inc: 'אקונומיקה', exc: 'מגבונים|ספריי' }, codes: ['7290000288024', '7290000294773', '7290000294780', '7290001791349'] },
  { id: 'shampoo', label: 'שמפו 700–750 מ״ל', words: ['שמפו'],
    find: { inc: '^שמפו', exc: 'יבש|כלב|חתול' }, codes: ['7290001136287', '7290012116025'] },
  { id: 'toothpaste', label: 'משחת שיניים 75 מ״ל', words: ['משחת שיניים'],
    find: { inc: 'משחת שיניים', exc: 'מברשת' }, codes: ['8718951466371', '8718951579545', '7290017031705'] },
  { id: 'water', label: 'מים מינרליים 6×1.5 ליטר', words: ['מים', 'מים מינרלים', 'שישיית מים'], not: ['ורדים', 'סודה', 'טעם'],
    find: { inc: 'מים מינרלים|נביעות|מי עדן|מי.?עדן', exc: 'טעם|סודה|ורדים|פחית' }, codes: ['7290019056973', '7290110114855'] },
  { id: 'cola', label: 'קוקה קולה 1.5 ליטר', words: ['קולה', 'קוקה קולה', 'קוקה'], not: ['זירו', 'דיאט'],
    find: { inc: 'קוקה.?קולה', exc: 'זירו|דיאט|פחית|ללא סוכר' }, codes: ['7290110115203'] },
  { id: 'chicken', label: 'חזה עוף טרי', kg: true, words: ['חזה עוף', 'חזה'], not: ['הודו', 'נקניק', 'פסטרמ'],
    find: { inc: 'חזה עוף', exc: 'נקניק|פסטרמה|מעושן|שניצל|ממולא|מתובל', weighted: true }, local: { [S]: ['7290002685050', '7290004859671', '7290002649694', '7290005590320', '7290000616827'], [R]: ['7290002687153'], [Y]: ['7290004194536'], [C]: ['3502', '7290000611860', '7290000680161', '7290000859671'] } },
  { id: 'tomato', label: 'עגבניות', kg: true, words: ['עגבניה', 'עגבניות'], not: ['שרי', 'רסק', 'מרוסק', 'רוטב', 'מיובש'],
    find: { inc: '^עגבני', exc: 'שרי|מרוסק|רסק|רוטב|מיובש|פרוס|קופס|תמר|ענבי', weighted: true }, local: { [S]: ['7290000000022'], [R]: ['7290000000100', '100'], [Y]: ['725'], [C]: ['1501'] } },
  { id: 'cucumber', label: 'מלפפונים', kg: true, words: ['מלפפון', 'מלפפונים'], not: ['חמוצ', 'כבוש', 'במלח'],
    find: { inc: '^מלפפו', exc: 'חמוצ|כבוש|במלח|בחומץ|בייבי', weighted: true }, local: { [S]: ['7290000000046'], [R]: ['7290000000101', '7290000001014', '101'], [Y]: ['7290000000695'], [C]: ['1502'] } },
  { id: 'potato', label: 'תפוחי אדמה', kg: true, words: ['תפוחי אדמה', 'תפוח אדמה', 'תפוד', 'תפודים'], not: ['מתוק', 'בטטה'],
    find: { inc: '^תפו"?א|^תפוח אדמה|^תפוחי אדמה|^תפוד', exc: 'בטטה|מקלות|פירה|צ.?יפס|קפוא|אדום', weighted: true }, local: { [S]: ['7290000000596', '7290000001715'], [R]: ['7290000000111', '7290000000422'], [Y]: ['345', '785'], [C]: ['1494', '1550'] } },
  { id: 'onion', label: 'בצל', kg: true, words: ['בצל', 'בצלים', 'בצל יבש'], not: ['ירוק', 'סגול', 'אבקת', 'מטוגן'],
    find: { inc: '^בצל', exc: 'ירוק|סגול|אדום|מטוגן|אבקת|קפוא|שאלוט', weighted: true }, local: { [S]: ['7290000000480'], [R]: ['7290000000108'], [Y]: ['620'], [C]: ['1519'] } },
  { id: 'banana', label: 'בננות', kg: true, words: ['בננה', 'בננות'],
    find: { inc: '^בננ', exc: 'מיובש|צ.?יפס|משקה', weighted: true }, local: { [S]: ['7290000964775'], [R]: ['7290000000134'], [Y]: ['623'], [C]: ['1556'] } },
  { id: 'carrot', label: 'גזר', kg: true, words: ['גזר'], not: ['מגורר', 'מיץ', 'גמדי'],
    find: { inc: '^גזר', exc: 'מגורר|מיץ|גמדי|בייבי|קלוף', weighted: true }, local: { [S]: ['7290000001661', '7290011128005'], [R]: ['7290000000102', '7290000000249'], [Y]: ['343', '635'], [C]: ['1503', '7290000002317'] } },
  { id: 'lemon', label: 'לימונים', kg: true, words: ['לימון', 'לימונים'], not: ['מיץ', 'תבלין'],
    find: { inc: '^לימון', exc: 'מיץ|תבלין|מלח|משקה|לימונית', weighted: true }, local: { [S]: ['7290000964492'], [R]: ['7290000000117', '7290000001117'], [Y]: ['691'], [C]: ['1551'] } },
  { id: 'apple', label: 'תפוחי עץ', kg: true, words: ['תפוח', 'תפוחים', 'תפוחי עץ', 'תפוח עץ'], not: ['אדמה', 'מיץ'],
    find: { inc: '^תפוח (עץ|גאלה|פינק|סמיט|גרני|זהוב|יונתן|חרמון|ענברי|סטארקינג)', exc: 'אדמה|מיץ|מיובש', weighted: true }, local: { [S]: ['7290000963082', '7290000963228', '7290000963426', '7290000963518'], [R]: ['7290000000115', '7290000000149', '7290000000186', '7290000000219'], [Y]: ['787', '788', '792'], [C]: ['1561', '1563', '1564', '1645'] } }
]);
export const BASKET_BY_ID = Object.fromEntries(BASKET.map(b => [b.id, b]));

const norm = s => normItem(s);
const LINES = BASKET.map(b => ({ b, words: b.words.map(norm), not: (b.not || []).map(norm) }));

/* The basket line a list item is, or null. The longest matching word wins,
   so "שמן זית" is olive oil and not oil. */
export function lineOf(title) {
  const t = norm(title);
  if (!t) return null;
  let best = null, len = 0;
  for (const { b, words, not } of LINES) {
    if (not.some(n => t.includes(n))) continue;
    for (const w of words) {
      if (w.length > len && (t === w || t.startsWith(w + ' '))) { best = b; len = w.length; }
    }
  }
  return best;
}

/* What a store charges for a line, from one store's prices in the built
   data ({ lineId: price }), or null when it does not have it. */
export function linePrice(storePrices, id) {
  const p = storePrices && storePrices[id];
  return typeof p === 'number' && p > 0 ? p : null;
}

/* A list, priced at each store that has data. `stores` is
   [{ chainId, storeId, name, prices }]. Returns, per store,
   { chainId, storeId, name, total, have, lines } where `have` counts the
   list's basket lines the store prices; and `matched`, the list's basket
   lines. Stores are compared on the lines all of them have, so a store is
   not cheaper for lacking the expensive item; `common` is that count. */
export function priceList(titles, stores) {
  const ids = [...new Set((titles || []).map(t => lineOf(t)).filter(Boolean).map(b => b.id))];
  const common = ids.filter(id => (stores || []).every(s => linePrice(s.prices, id) !== null));
  const rows = (stores || []).map(s => ({
    chainId: s.chainId,
    storeId: s.storeId,
    name: s.name,
    have: ids.filter(id => linePrice(s.prices, id) !== null).length,
    total: Math.round(common.reduce((sum, id) => sum + linePrice(s.prices, id), 0) * 100) / 100
  }));
  rows.sort((a, b) => a.total - b.total);
  return { matched: ids, common, rows };
}

/* Where the daily build publishes, one file per chain (see
   .github/workflows/prices.yml): a public repository of its own, since this
   one is private and a phone cannot read it. raw.githubusercontent.com sends
   a CORS header, which is the reason it is read from there. */
export const PRICES_BASE = 'https://raw.githubusercontent.com/idoravid15-art/homi-prices/main/';
export const pricesUrl = chainId => PRICES_BASE + (CHAIN_BY_ID[chainId]?.key || 'x') + '.json';
/* The chain's whole shelf (scripts/prices.mjs), for what the basket does not know. */
export const catalogUrl = chainId => PRICES_BASE + 'catalog-' + (CHAIN_BY_ID[chainId]?.key || 'x') + '.json';

/* A store as people say it: the chain, then the branch. Some chains already
   start a branch's name with their own ("קרפור כרכור"), which made it
   "קרפור קרפור כרכור"; the chain is said once. Spaces the files double are
   closed up. */
export function storeLabel(chainId, storeName) {
  const chain = CHAIN_BY_ID[chainId]?.name || '';
  const name = String(storeName || '').replace(/\s+/g, ' ').trim();
  if (!chain) return name;
  if (!name) return chain;
  return name.startsWith(chain) ? name : `${chain} ${name}`;
}

/* A chain's stores matching what was typed, by name or address. Store names
   usually carry the town ("שלי באר יעקב"); the city itself is only a code. */
export function searchStores(data, q, limit = 30) {
  const words = normItem(q).split(' ').filter(Boolean);
  const out = [];
  for (const [id, s] of Object.entries((data && data.stores) || {})) {
    const hay = normItem(`${s.n || ''} ${s.a || ''}`);
    if (words.every(w => hay.includes(w))) out.push({ id, name: s.n || `סניף ${id}`, address: s.a || '' });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'he'));
  return out.slice(0, limit);
}

/* A day is enough: the build runs once each morning. */
export const isStale = (fetchedAt, now = Date.now()) => !fetchedAt || now - fetchedAt > 20 * 36e5;
