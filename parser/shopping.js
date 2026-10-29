/* ==========================================================
   shopping text — turning a WhatsApp message into a shopping list, and a
   shopping list into supermarket aisles.

   Pure, and deliberately separate from parse.js: this side never looks at a
   clock at all. Its own golden cases live in tests/shopping.test.js.
   ========================================================== */

/* ==========================================================
   מדפים — סידור רשימת הקניות לפי סדר ההליכה בסופר

   Keywords are stems, matched against the start of a word: 'עגבני' catches
   עגבניה and עגבניות alike. Within an item the FIRST word that matches wins,
   which is what makes "לחם לבן" bread and "יוגורט לבן" dairy; where two stems
   match the same word the longer one wins, which is what keeps חלבה out of
   the dairy aisle and כוסברה out of the cleaning one.
   ========================================================== */
export const AISLES = [
  {id:'produce', emoji:'🥬', name:'ירקות ופירות', words:[
    'עגבני','מלפפון','חסה','גזר','בצל','שום','שומר','תפוח','תפוד','תפודי','בננ','לימון','אבוקדו',
    'פלפל','קישוא','חציל','בטטה','כרוב','כרובית','ברוקולי','סלרי','פטרוזיל','כוסבר','שמיר','נענע',
    'בזיליק','תות','ענב','אבטיח','מלון','אפרסק','נקטרינ','שזיף','אגס','רימון','תמר','תאנ','קלמנטינ',
    'תפוז','אשכולי','מנגו','קיווי','אננס','פטרי','דלעת','סלק','צנון','נבט','ארטישוק','אספרגוס',
    'חמוצ','ירקות','פירות','לפת','כרישה','במיה','שעועית ירוקה']},
  {id:'dairy', emoji:'🥛', name:'מוצרי חלב וביצים', words:[
    'חלב','קוטג','גבינ','שמנת','יוגורט','לבנה','לבן','אשל','חמאה','ביצ','מעדן','דנונה','מילקי','יופלה',
    'ריקוטה','מוצרל','צפתית','בולגרית','שוקו','אקטימל','קצפת','גיל','תנובה','פרו']},
  {id:'meat', emoji:'🥩', name:'בשר, עוף ודגים', words:[
    'בשר','עוף','הודו','שניצל','קציצ','נקניק','נקניקי','סלמון','דגים','פילה','כבד','אנטריקוט',
    'המבורגר','קבב','שוקיים','חזה','כנפי','פסטרמ','סטייק','טחון','אסאדו','שווארמ','פרגי','דג']},
  {id:'bakery', emoji:'🍞', name:'מאפים ולחם', words:[
    'לחם','לחמני','פיתה','פיתות','בגט','חלה','לאפה','טורטי','קרואסון','בורקס','מאפה','בייגל',
    'מצה','מצות','פיצה','רוגלך','חלות']},
  {id:'frozen', emoji:'🧊', name:'קפואים', words:[
    'קפוא','גלידה','שלגון','מלאווח','גחנון',"ג'חנון",'פילו','ארטיק','אפונה']},
  {id:'dry', emoji:'🥫', name:'יבשים ושימורים', words:[
    'אורז','פסטה','ספגטי','קוסקוס','בורגול','קינואה','עדש','חומוס','שעועית','גרגר','קמח','סוכר',
    'מלח','תבלין','פפריק','כמון','כורכום','קינמון','אורגנו','זעתר','בהרט','הל','ציפורן',
    'שמן','חומץ','רסק','שימור','תירס','זית','טחינה','ריבה','דבש','ממרח','קטשופ',
    'מיונז','חרדל','סויה','שקד','אגוז','בוטנ','גרעינ','צימוק','פתית','שיבולת','גרנול','דגני',
    'קורנפלקס','קפה','תה ','נס','סוכרזית','אבקת','שמרים','שומשום','פירורי','מרק','אבקה','טונה','אבקת סוכר',
    'חלבה','סילאן','סירופ','שוקולית','קוואקר']},
  {id:'snacks', emoji:'🍫', name:'חטיפים ומתוקים', words:[
    'חטיף','במבה','ביסלי','ציפס',"צ'יפס",'תפוצ','שוקולד','סוכרי','ופל','עוגי','עוגה','קרקר',
    'מסטיק','דובונים','פופקורן','אפרופו','קליק','פררו','מרשמלו','נוגט']},
  {id:'drinks', emoji:'🥤', name:'משקאות', words:[
    'מים','סודה','קולה','ספרייט','מיץ','בירה','יין','וודקה','משקה','תרכיז','פריגת','שוופס',
    'אנרגי','ערק','ויסקי','טוניק','נביעות','מי ורדים','מים מינרלים']},
  {id:'clean', emoji:'🧻', name:'ניקיון וחד־פעמי', words:[
    'סבון','אקונומיקה','מנקה','ניקוי','כביס','מרכך','ספוג','מגב','שקי','נייר','מגבות','צלחות',
    'כוסות','סכום','נרות','אשפה','מטהר','כפפות','סמרטוט','טישו','אבקת כביסה','ג׳ל','אבק','ריצפה',
    'חלון','תנור','כלים','מפית','מפיות','קיסמ','אלומיניום','ניילון','שקיות',
    'אבקת כביסה','ג׳ל כביסה','מרכך כביסה','נייר טואלט','מגבות נייר','נייר סופג']},
  {id:'care', emoji:'🧴', name:'טיפוח ותינוקות', words:[
    'שמפו','דאודורנט','משחת','מברשת','גילוח','קרם','תחבושת','טמפון','חיתול','מגבון','מוצץ','פדים',
    'אקמול','ויטמין','תרופ','פלסטר','אצטמינופן','נורופן','משחה','בושם','לק',
    'מרכך שיער','משחת שיניים','נייר דבק','סבון רחצה','סבון ידיים']},
  {id:'pets', emoji:'🐕', name:'חיות מחמד', words:[
    'חתול','כלב','ווסקס','פדיגרי','חול לחתול','אוכל לחתול','אוכל לכלב','מזון לחתול','מזון לכלב',
    'חטיפים לכלב','חטיפים לחתול']},
  {id:'misc', emoji:'🛒', name:'שונות', words:[]}
];
export const AISLE_BY_ID = Object.fromEntries(AISLES.map(a=>[a.id,a]));
export const MISC_AISLE = AISLE_BY_ID.misc;

/* Hebrew final forms are different codepoints, so 'מלפפונים' does not start
   with 'מלפפון' — ן and נ are not the same letter. Folding the five finals in
   both the keywords and the item makes every singular stem catch its plural. */
const FINALS = {'ך':'כ','ם':'מ','ן':'נ','ף':'פ','ץ':'צ'};
export const foldFinals = t => t.replace(/[ךםןףץ]/g, c => FINALS[c]);

const NIQQUD = /[\u0591-\u05C7]/g;
export const QTY = /^\s*\d+(?:[.,]\d+)?\s*(?:ק"?ג|קג|גרם|גר|ליטר|ל|מ"?ל|יח['׳]?|יחידות|חבילות?|בקבוקים?|קופסאות?|שקיות?|אריזות?|מארזים?)?\s+/;
export function normItem(s){
  return String(s ?? '')
    .replace(NIQQUD, '')
    .replace(QTY, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[ךםןףץ]/g, c => FINALS[c]);
}
// RTDB keys reject . $ # [ ] / — a normalised name is otherwise a fine key
export const itemSlug = s => (normItem(s).replace(/\s+/g,'-').replace(/[.$#\[\]\/]/g,'').slice(0,60)) || 'x';

// single stems are matched per word; anything with a space is matched against
// the whole item, so "אבקת כביסה" beats the bare "אבקת" in the dry-goods aisle
// keywords go through the same normaliser as the items, or an apostrophe in
// "צ'יפס" would make a keyword no item can ever match
const _kw = AISLES.flatMap(a => a.words.map(w => ({ w: normItem(w), a }))).filter(x => x.w);
const byLongest = (x,y) => y.w.length - x.w.length;
const AISLE_WORDS   = _kw.filter(x => !x.w.includes(' ')).sort(byLongest);
const AISLE_PHRASES = _kw.filter(x =>  x.w.includes(' ')).sort(byLongest);

// the longest matching stem wins, which keeps חלבה out of the dairy aisle and
// כוסברה out of the cleaning one
function matchWord(w){
  let best = null, len = 0;
  for(const { w: k, a } of AISLE_WORDS)
    if(k.length > len && (w === k || w.startsWith(k))){ best = a; len = k.length; }
  return best;
}
const HE_PREFIX = /^[ולבכמשה]/;   // conjunctions and prepositions: "וחלב", "לחתול"
export function aisleOf(title){
  const norm = normItem(title);
  for(const { w, a } of AISLE_PHRASES) if(norm.includes(w)) return a;
  for(const raw of norm.split(' ').filter(Boolean)){
    // the bare word first; a stripped prefix is only ever a fallback
    const hit = matchWord(raw)
      || (raw.length > 3 && HE_PREFIX.test(raw) ? matchWord(raw.slice(1)) : null);
    if(hit) return hit;
  }
  return MISC_AISLE;
}
/* ==========================================================
   הדבקת רשימה

   In Israel a shopping list arrives as a WhatsApp message, not as a note on
   the fridge. Splitting text on lines and commas needs no model, no server
   and no network, so this works offline and costs nothing.
   ========================================================== */
export const PASTE_MAX_ITEMS = 60;

// a message opens with an instruction, not with an item
// no \b here: JavaScript word boundaries are ASCII-only and never fire between
// Hebrew letters — the required trailing space or colon is the boundary
const PASTE_OPENER = /^(?:תביאו?|תביאי|תקנו?|תקני|קנו?|קני|צריך|צריכים|צריכות|תזכרו?|תזכרי|אל תשכחו?|אל תשכחי|בבקשה|רשימת קניות|רשימה)[\s:]+/;
const PASTE_MARKS = /^[☐☑✅✔️✔✓✗✘❌🔲🔳▢□■●]\s*/u;

/* "חלב, לחם ונייר טואלט" — a vav joins the last two items of an enumeration.
   Splitting on every vav would wreck ordinary words, so this only fires inside
   a line that already used commas, never when the vav opens the segment
   ("ועד בית"), and never for words that simply begin with one. */
// stems without final letters, tested against a folded copy: ן and נ are
// different codepoints, so a guard spelled "יטמין" never sees "ויטמינים"
const VAV_WORDS = /^ו(?:עד|ילונ|יטמינ|ופל|רד|ודקה|פל|ניל)/;
export function splitVav(segment){
  const m = segment.match(/^(.+?\S)\s+ו(\S.*)$/);
  if(!m) return [segment];
  if(VAV_WORDS.test(foldFinals('ו' + m[2]))) return [segment];
  const tail = m[2].replace(/^[-–]/, '');
  if(tail.length < 2) return [segment];
  return [m[1], tail];
}

/* How many, however it was written: "2 חלב", "2 ליטר חלב", "חלב x2",
   "חלב ×2", "חלב 2 יח׳". The name is what is bought; the count rides along
   and is shown in front of it, the way the list writes it. */
const QTY_UNIT = '(?:ליטר|ליטרים|קילו|ק["״]ג|גרם|חבילות|חבילה|בקבוקים|בקבוק|שקיות|שקית|קופסאות|קופסה|יחידות|יח[\'׳]?|מארז|מארזים|זוגות|זוג)';
export function splitQty(item){
  /* "חלב (2)", "2x חלב", "חלב - 2". */
  let m = item.match(/^(.*\p{L}.*?)\s*\((\d+(?:[.,]\d+)?)\)$/u) || item.match(/^(.*\p{L}.*?)\s+[-–]\s*(\d+(?:[.,]\d+)?)$/u);
  if(m) return { name: m[1].trim(), qty: m[2] };
  if((m = item.match(/^(\d+)\s*[x×]\s+(\D.*)$/))) return { name: m[2].trim(), qty: m[1] };
  m = item.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(?:x|×)?\\s*(${QTY_UNIT})?\\s+(\\D.*)$`));
  if(m) return { name: m[3].trim(), qty: m[2] ? `${m[1]} ${m[2]}` : m[1] };
  m = item.match(new RegExp(`^(.*\\D)\\s*(?:[x×*]\\s*(\\d+)|\\s(\\d+)\\s*(${QTY_UNIT})?)$`));
  if(m && /\p{L}/u.test(m[1])) return { name: m[1].trim(), qty: m[2] || (m[4] ? `${m[3]} ${m[4]}` : m[3]) };
  return { name: item, qty: '' };
}

export function parsePasted(text, { keepRepeats = false } = {}){
  const seen = new Set();
  const out = [];
  for(const rawLine of String(text || '').split(/\r?\n/)){
    // a pasted WhatsApp export carries "[12:34, 20/09/2026] נעמה: " in front
    const line = rawLine
      .replace(/^\s*\[[^\]]{4,40}\]\s*[^:]{1,40}:\s*/, '')
      .trim()
      .replace(PASTE_OPENER, '');
    if(!line) continue;
    const segments = line.split(/[,;]+|\s[•·]\s/);
    // the vav rule needs the comma as evidence that this line is a list
    const parts = segments.length > 1 ? segments.flatMap(splitVav) : segments;
    for(const part of parts){
      const item = part
        .replace(/^[\s\-–—•*·>]+/, '')        // bullets
        .replace(/^\d+[.)]\s*/, '')           // "1. " numbering
        .replace(/^\[[\sxXvV✓]?\]\s*/, '')   // "[ ] " checkboxes
        .replace(PASTE_MARKS, '')
        .replace(/[.\s]+$/, '')
        .trim()
        .slice(0, 60);
      if(!item || !/\p{L}/u.test(item)) continue;   // pure numbers or punctuation
      if(/^https?:\/\//i.test(item)) continue;
      const key = itemSlug(item);
      if(!key || key === 'x' || (!keepRepeats && seen.has(key))) continue;
      seen.add(key);
      out.push(splitQty(item));
      if(out.length >= PASTE_MAX_ITEMS) return out;
    }
  }
  return out;
}
