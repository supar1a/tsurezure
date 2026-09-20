import { paragraphs, splitAroundPhoto } from "./text";
import { glyphOf } from "./marks";
import type { StorySource } from "./story";
import { LOGO_PATH } from "../components/logo-path";

/*
 * 一篇の絵を、ブラウザ自身の縦組みで組む。
 *
 * 前は canvas に一字ずつ置いていたが、句読点の詰めや禁則までは真似しきれなかった。
 * ここでは本物の縦組み（writing-mode: vertical-rl）で HTML を組み、それを SVG の foreignObject に入れて
 * 絵として canvas に写す。句読点も、小書きの仮名も、倒れるラテン文字も、画面と同じに出る。
 *
 * 気をつけること：
 *   ・SVG を絵として読むと、外の資源（Web フォント）は読まれない。使う字のぶんだけ、字体を data URL で埋め込む。
 *     Google Fonts は字体を unicode-range で百あまりに割って配っているので、本文に出てくる字を含む片だけ取る。
 *   ・Safari は、埋め込んだ字体を解く前に一度描いてしまうことがある。数回描き直して、最後の一枚を使う。
 *   ・収まるかどうかは、同じ HTML を画面の外に置いて実際に測る。字は小さくしない。余れば末尾を「…」で切る。
 *   ・左上の印は字ではなくロゴ（柱と同じ筆の字）。SVG の path としてそのまま描く。
 */

const W = 1080;
const H = 1920;
const FAMILY = "Shippori Mincho B1";
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@400;600&display=swap";
const XHTML = "http://www.w3.org/1999/xhtml";

const BODY_SIZE = 42; // 本文の字。読みやすさを優先して大きめに。収まらない分は「…」で切る
// ロゴ（もとは 60×223）。柱のロゴと同じか、少し大きいくらい
const LOGO_H = 290;
const LOGO_W = Math.round((LOGO_H * 60) / 223);
const LEFT = 120;
const GUTTER = LOGO_W + 48; // ロゴと日付の列。本文はその右から

const SHEET = `
.page { position: relative; width: ${W}px; height: ${H}px; margin: 0; color: #1e1b16;
  font-family: "${FAMILY}", "Hiragino Mincho ProN", "Yu Mincho", serif; font-weight: 400;
  font-feature-settings: "vpal" 1, "vkrn" 1; line-break: strict; -webkit-font-smoothing: antialiased; }
.flow { position: absolute; top: 200px; right: 120px; width: ${W - 120 - LEFT - GUTTER}px; height: 1520px;
  writing-mode: vertical-rl; -webkit-writing-mode: vertical-rl; text-orientation: mixed; overflow: hidden; }
.t { margin: 0; font-size: 56px; font-weight: 600; letter-spacing: 0.22em; line-height: 1.9; margin-block-end: 0.9em; }
.b { letter-spacing: 0.16em; line-height: 2; } /* 画面（2.4）より少し詰める。絵は幅が限られるので、列を一本でも多く */
.p { margin: 0; text-indent: 1em; }
.p.m { text-indent: -1.4em; padding-inline-start: 1.4em; }
.p.apart { padding-block-start: 1.1em; }
.mk { display: inline-block; min-inline-size: 1.4em; text-indent: 0; color: #5f574c; }
.rule { block-size: 2px; inline-size: 76%; margin-block: 1.1em; margin-inline: 12%; background: rgba(33, 30, 25, 0.18); }
.date { position: absolute; left: ${LEFT}px; bottom: 200px; inline-size: auto; block-size: ${LOGO_W}px;
  writing-mode: vertical-rl; -webkit-writing-mode: vertical-rl; text-align: start;
  font-size: 26px; line-height: ${LOGO_W}px; letter-spacing: 0.2em; white-space: nowrap; color: #5f574c; }
`;

/** 絵にする HTML を組む。bodySize は本文の字の大きさ、limit は本文を何字で切るか（切ったら「…」）。 */
function build(slip: StorySource, bodySize: number, limit: number | null): HTMLElement {
  const el = (tag: string, cls?: string, text?: string) => {
    const e = document.createElementNS(XHTML, tag) as HTMLElement;
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const page = el("div", "page");
  const flow = el("div", "flow");
  if (slip.title) flow.append(el("h1", "t", slip.title));

  const { before, after } = splitAroundPhoto(slip.body);
  let text = [before, after].filter(Boolean).join("\n\n");
  if (limit !== null && [...text].length > limit) text = [...text].slice(0, limit).join("").trimEnd() + "…";

  const body = el("div", "b");
  body.style.fontSize = `${bodySize}px`;
  for (const line of paragraphs(text)) {
    if (line.rule) { body.append(el("div", "rule")); continue; }
    const p = el("p", ["p", line.mark ? "m" : "", line.afterBlank ? "apart" : ""].filter(Boolean).join(" "));
    if (line.mark) p.append(el("span", "mk", glyphOf(line.mark).trim()));
    p.append(document.createTextNode(line.text));
    body.append(p);
  }
  flow.append(body);
  page.append(flow, el("div", "date", slip.date));
  return page;
}

/** 画面の外に置いて、縦の流れが枠に収まっているかを測る。 */
function fits(page: HTMLElement): boolean {
  const flow = page.querySelector(".flow") as HTMLElement;
  return flow.scrollWidth <= flow.clientWidth + 1;
}

/** 収まる組みを探す：字の大きさは変えず、余れば末尾を切る。 */
async function compose(slip: StorySource): Promise<HTMLElement> {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;height:${H}px;pointer-events:none;contain:layout style;`;
  const style = document.createElement("style");
  style.textContent = SHEET;
  host.append(style);
  document.body.append(host);
  try {
    const mount = (p: HTMLElement) => { host.querySelector(".page")?.remove(); host.append(p); return p; };
    // 字体が来てから測る（来る前だと代わりの字体の寸法で測ってしまう）
    const whole = mount(build(slip, BODY_SIZE, null));
    await document.fonts.ready;
    if (fits(whole)) return whole.cloneNode(true) as HTMLElement;

    // 余る：収まる字数を二分で探して、末尾を「…」で切る
    let lo = 0, hi = [...slip.body].length;
    while (hi - lo > 2) {
      const mid = (lo + hi) >> 1;
      if (fits(mount(build(slip, BODY_SIZE, mid)))) lo = mid; else hi = mid;
    }
    return mount(build(slip, BODY_SIZE, lo)).cloneNode(true) as HTMLElement;
  } finally {
    host.remove();
  }
}

/* ── 字体を埋め込む ── */

type Face = { weight: string; url: string; range: string; ranges: [number, number][] };
let faces: Promise<Face[]> | null = null;
const fontData = new Map<string, Promise<string>>();

function loadFaces(): Promise<Face[]> {
  if (!faces) {
    faces = fetch(FONT_CSS).then((r) => r.text()).then((css) => {
      const out: Face[] = [];
      for (const block of css.match(/@font-face\s*{[^}]*}/g) ?? []) {
        const url = /src:\s*url\(([^)]+)\)/.exec(block)?.[1]?.replace(/["']/g, "");
        const weight = /font-weight:\s*(\d+)/.exec(block)?.[1] ?? "400";
        const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1];
        if (!url || !range) continue;
        const ranges = range.split(",").map((r): [number, number] => {
          const m = /U\+([0-9A-Fa-f?]+)(?:-([0-9A-Fa-f]+))?/.exec(r.trim());
          if (!m) return [0, -1];
          if (m[1].includes("?")) return [parseInt(m[1].replace(/\?/g, "0"), 16), parseInt(m[1].replace(/\?/g, "F"), 16)];
          const a = parseInt(m[1], 16);
          return [a, m[2] ? parseInt(m[2], 16) : a];
        });
        out.push({ weight, url, range: range.trim(), ranges });
      }
      return out;
    });
    faces.catch(() => { faces = null; });
  }
  return faces;
}

function dataUrl(url: string): Promise<string> {
  let p = fontData.get(url);
  if (!p) {
    p = fetch(url).then((r) => r.blob()).then((blob) => new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    }));
    fontData.set(url, p);
    p.catch(() => fontData.delete(url));
  }
  return p;
}

/** 使う字を含む片だけを、data URL の @font-face にして返す。 */
async function embeddedFonts(regular: string, bold: string): Promise<string> {
  const all = await loadFaces();
  const points = (s: string) => new Set([...s].map((c) => c.codePointAt(0) ?? 0));
  const want: Record<string, Set<number>> = { "400": points(regular), "600": points(bold) };
  const rules: string[] = [];
  await Promise.all(all.map(async (face) => {
    const need = want[face.weight];
    if (!need || need.size === 0) return;
    let hit = false;
    for (const cp of need) { if (face.ranges.some(([a, b]) => cp >= a && cp <= b)) { hit = true; break; } }
    if (!hit) return;
    const data = await dataUrl(face.url);
    // unicode-range を落とさない。落とすと WebKit は最後の一片だけを見て、そこに無い字をぜんぶ代わりの字体に回す
    rules.push(`@font-face{font-family:"${FAMILY}";font-style:normal;font-weight:${face.weight};src:url(${data}) format("woff2");unicode-range:${face.range};}`);
  }));
  return rules.join("\n");
}

const WARM = 3; // Safari で、埋め込んだ字体が効くまで描き直す回数
const SAFARI = typeof navigator !== "undefined" && /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("絵を読めませんでした"));
    img.src = src;
  });
}

/** 組んだものを、透けた絵として ctx に写す（紙の地は呼ぶ側が先に塗っておく）。 */
export async function drawStoryText(ctx: CanvasRenderingContext2D, slip: StorySource): Promise<void> {
  const page = await compose(slip);
  const fonts = await embeddedFonts(page.textContent ?? "", slip.title ?? "");

  const style = document.createElementNS(XHTML, "style");
  style.textContent = fonts + SHEET;
  page.prepend(style);

  const xhtml = new XMLSerializer().serializeToString(page);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">${xhtml}</foreignObject><path transform="translate(${LEFT} 200) scale(${LOGO_H / 223})" fill="#1e1b16" d="${LOGO_PATH}"/></svg>`;
  const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

  // Safari は埋め込んだ字体を解く前に描くことがある。捨ての一枚に何度か描いてから、本番を描く
  if (SAFARI) {
    const scratch = document.createElement("canvas");
    scratch.width = W; scratch.height = H;
    const sctx = scratch.getContext("2d");
    for (let i = 0; i < WARM; i++) {
      const warm = await loadImage(src);
      sctx?.drawImage(warm, 0, 0, W, H);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  const img = await loadImage(src);
  ctx.drawImage(img, 0, 0, W, H);
}
