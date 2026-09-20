const DIGITS = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 年号のように一桁ずつ並べる（二〇二六） */
function spellDigits(n: number) {
  return String(n)
    .split("")
    .map((d) => DIGITS[Number(d)])
    .join("");
}

/** 十進の位取り（十五・二十一）。1〜99 を想定。 */
export function kanjiNumber(n: number): string {
  if (n < 0) return "−" + kanjiNumber(-n);
  if (n < 10) return DIGITS[n];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return (tens === 1 ? "" : DIGITS[tens]) + "十" + (ones ? DIGITS[ones] : "");
  }
  return spellDigits(n);
}

const TZ = "Asia/Tokyo";

function partsOf(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
  };
}

/** 二〇二六年九月三日 */
export function kanjiDate(date: Date) {
  const { year, month, day } = partsOf(date);
  return `${spellDigits(year)}年${kanjiNumber(month)}月${kanjiNumber(day)}日`;
}

/** 九月三日（同じ年なら年を省く） */
export function kanjiDateShort(date: Date, now = new Date()) {
  const a = partsOf(date);
  const b = partsOf(now);
  const md = `${kanjiNumber(a.month)}月${kanjiNumber(a.day)}日`;
  return a.year === b.year ? md : `${spellDigits(a.year)}年${md}`;
}

/** 午後九時四十分 */
export function kanjiTime(date: Date) {
  // 分は出さない（切り捨て）。書き散らしに、分刻みの正確さは要らない
  const { hour } = partsOf(date);
  const meridiem = hour < 12 ? "午前" : "午後";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${meridiem}${kanjiNumber(h12)}時ころ`;
}
