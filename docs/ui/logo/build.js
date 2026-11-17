// PowerShell, from this folder, with no repository dependency added:
// npm install --prefix "$env:TEMP\crunch-week-logo-renderer" --no-save --package-lock=false @resvg/resvg-js@2.6.2
// $env:NODE_PATH = "$env:TEMP\crunch-week-logo-renderer\node_modules"
// node .\build.js
// Generated files are written to ./out; the checked-in preview is the approved sheet.
// Builds the app symbol (direction A: weekly bars, one week breaking the line)
// as SVG, then renders every PNG the Expo app uses, plus a preview sheet.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const C = {
  teal: '#1F5C6B', soft: '#E2EDEF', ink: '#16202A', white: '#FFFFFF', bg: '#F3F6F6',
  calm: '#3F7F6E', moderate: '#B8912A', heavy: '#A93F30',
};

// Symbol geometry in its own units. Bars stand on y = 0 and grow upwards.
const BAR_W = 112, GAP = 40, RADIUS = 28;
const HEIGHTS = [210, 290, 350, 560, 250];
const TALL = 3;
const LINE_Y = -440, LINE_W = 44, LINE_OVERHANG = 40, KNOCKOUT = 22;
const barX = (i) => i * (BAR_W + GAP);
const ROW_W = 5 * BAR_W + 4 * GAP;
// Bounding box, including the line's round caps.
const BOX = { x0: -LINE_OVERHANG - LINE_W / 2, x1: ROW_W + LINE_OVERHANG + LINE_W / 2, y0: -Math.max(...HEIGHTS), y1: 0 };
BOX.w = BOX.x1 - BOX.x0; BOX.h = BOX.y1 - BOX.y0;
BOX.cx = (BOX.x0 + BOX.x1) / 2; BOX.cy = (BOX.y0 + BOX.y1) / 2;

let maskId = 0;
/** The symbol as SVG markup. colors: one colour for everything, or the full palette. */
function symbol(colors) {
  const one = colors !== 'palette';
  const barColor = (i) => one ? colors : [C.calm, C.moderate, C.moderate, C.heavy, C.calm][i];
  const lineColor = one ? colors : C.teal;
  const id = `knock${maskId++}`;
  const t = barX(TALL), th = HEIGHTS[TALL];
  // The line stops short of the tall bar on both sides, so the week reads as breaking through it.
  const mask = `<mask id="${id}" maskUnits="userSpaceOnUse" x="${BOX.x0 - 10}" y="${BOX.y0 - 10}" width="${BOX.w + 20}" height="${BOX.h + 20}">
    <rect x="${BOX.x0 - 10}" y="${BOX.y0 - 10}" width="${BOX.w + 20}" height="${BOX.h + 20}" fill="#fff"/>
    <rect x="${t - KNOCKOUT}" y="${-th - KNOCKOUT}" width="${BAR_W + 2 * KNOCKOUT}" height="${th + 2 * KNOCKOUT}" rx="${RADIUS + KNOCKOUT}" fill="#000"/>
  </mask>`;
  const line = `<line x1="${-LINE_OVERHANG}" y1="${LINE_Y}" x2="${ROW_W + LINE_OVERHANG}" y2="${LINE_Y}" stroke="${lineColor}" stroke-width="${LINE_W}" stroke-linecap="round" mask="url(#${id})"/>`;
  const bars = HEIGHTS.map((h, i) => `<rect x="${barX(i)}" y="${-h}" width="${BAR_W}" height="${h}" rx="${RADIUS}" fill="${barColor(i)}"/>`).join('');
  return `<defs>${mask}</defs>${line}${bars}`;
}

/** Places the symbol so its bounding box fits `width` units wide, centred at (cx, cy). */
function placed(colors, width, cx, cy) {
  const s = width / BOX.w;
  return `<g transform="translate(${cx - s * BOX.cx} ${cy - s * BOX.cy}) scale(${s})">${symbol(colors)}</g>`;
}

const svg = (size, body, w = size, h = size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// Android keeps the middle 66 of 108 units of an adaptive icon visible on every launcher (a circle).
const SAFE = 66 / 108;
/** Width that keeps the symbol's whole bounding box inside the safe circle of a `size` canvas. */
const safeWidth = (size, margin = 0.94) => {
  const diameter = size * SAFE * margin;
  return diameter * BOX.w / Math.hypot(BOX.w, BOX.h);
};

const files = {
  // Master symbol, transparent, for docs and future lockups.
  'logo-symbol.svg': svg(1000, placed('palette', 900, 500, 500)),
  'logo-symbol-mono.svg': svg(1000, placed(C.ink, 900, 500, 500)),
  // iOS and the default icon: a full square; iOS rounds the corners itself.
  'icon.svg': svg(1024, `<rect width="1024" height="1024" fill="${C.soft}"/>${placed('palette', 760, 512, 528)}`),
  'android-icon-foreground.svg': svg(512, placed('palette', safeWidth(512), 256, 262)),
  'android-icon-background.svg': svg(512, `<rect width="512" height="512" fill="${C.soft}"/>`),
  // Android tints the monochrome icon itself; any single opaque colour works.
  'android-icon-monochrome.svg': svg(432, placed(C.white, safeWidth(432), 216, 221)),
  // The splash shows this image on the teal background set in app.json.
  'splash-icon.svg': svg(512, placed(C.white, 480, 256, 266)),
  'favicon.svg': svg(48, `<rect width="48" height="48" rx="10" fill="${C.soft}"/>${placed('palette', 44, 24, 25)}`),
};

const pngSizes = {
  'icon.svg': 1024, 'android-icon-foreground.svg': 512, 'android-icon-background.svg': 512,
  'android-icon-monochrome.svg': 432, 'splash-icon.svg': 512, 'favicon.svg': 48,
};

for (const [name, markup] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), markup);
  if (pngSizes[name]) {
    const png = new Resvg(markup, { fitTo: { mode: 'width', value: pngSizes[name] } }).render().asPng();
    fs.writeFileSync(path.join(OUT, name.replace('.svg', '.png')), png);
  }
}

// Preview sheet: the icon as each platform shows it, at real sizes, in light and dark.
const iconInner = (size) => `<rect width="${size}" height="${size}" fill="${C.soft}"/>${placed('palette', size * 760 / 1024, size / 2, size * 528 / 1024)}`;
let sheet = '', x = 40;
const label = (tx, ty, text, color) => `<text x="${tx}" y="${ty}" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="${color}">${text}</text>`;
function row(y, bg, fg, title) {
  let out = `<rect x="0" y="${y}" width="1500" height="330" fill="${bg}"/>` + label(40, y + 34, title, fg);
  let cx = 40;
  // iOS rounded squares at 180, 120, 60 and the 48 / 29 spotlight sizes.
  for (const s of [180, 120, 60, 40, 29]) {
    const r = s * 0.2237;
    out += `<g transform="translate(${cx} ${y + 70})"><clipPath id="ios${s}${y}"><rect width="${s}" height="${s}" rx="${r}"/></clipPath><g clip-path="url(#ios${s}${y})">${iconInner(s)}</g></g>`;
    out += label(cx, y + 70 + 180 + 30, `iOS ${s}`, fg);
    cx += Math.max(s, 60) + 36;
  }
  // Android adaptive icon in a circle mask, at 108 and 48.
  for (const s of [108, 48]) {
    const scale = s / 512;
    out += `<g transform="translate(${cx} ${y + 70})"><clipPath id="and${s}${y}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></clipPath><g clip-path="url(#and${s}${y})"><rect width="${s}" height="${s}" fill="${C.soft}"/><g transform="scale(${scale})">${placed('palette', safeWidth(512), 256, 262)}</g></g></g>`;
    out += label(cx, y + 70 + 180 + 30, `Android ${s}`, fg);
    cx += Math.max(s, 80) + 36;
  }
  // Android monochrome (themed icon), tinted.
  out += `<g transform="translate(${cx} ${y + 70})"><circle cx="54" cy="54" r="54" fill="${bg === C.bg ? '#D7E3E6' : '#2B3A3F'}"/><g transform="scale(${108 / 432})">${placed(bg === C.bg ? C.teal : '#BFD8DD', safeWidth(432), 216, 221)}</g></g>`;
  out += label(cx, y + 70 + 180 + 30, 'Themed 108', fg);
  cx += 144;
  // Splash and favicon.
  out += `<g transform="translate(${cx} ${y + 70})"><rect width="150" height="180" rx="16" fill="${C.teal}"/><g transform="translate(37 52) scale(${76 / 512})">${placed(C.white, 480, 256, 266)}</g></g>`;
  out += label(cx, y + 70 + 180 + 30, 'Splash (76 wide)', fg);
  cx += 186;
  out += `<g transform="translate(${cx} ${y + 70})"><rect width="48" height="48" rx="10" fill="${C.soft}"/>${placed('palette', 44, 24, 25)}</g>`;
  out += label(cx, y + 70 + 180 + 30, 'Favicon 48', fg);
  return out;
}
sheet += row(0, C.bg, C.ink, 'Light home screen');
sheet += row(330, '#10181C', '#E3ECEE', 'Dark home screen');
sheet += `<rect x="0" y="660" width="1500" height="560" fill="#FFFFFF"/>` + label(40, 700, 'Large: icon 1024 shown at 480, and the symbol alone in colour and one colour', C.ink);
sheet += `<g transform="translate(40 730)"><clipPath id="big"><rect width="440" height="440" rx="98"/></clipPath><g clip-path="url(#big)">${iconInner(440)}</g></g>`;
sheet += placed('palette', 420, 760, 950) + placed(C.ink, 420, 1220, 950);
fs.writeFileSync(path.join(OUT, 'preview.svg'), svg(0, sheet, 1500, 1220));
fs.writeFileSync(path.join(OUT, 'preview.png'), new Resvg(svg(0, sheet, 1500, 1220), { font: { loadSystemFonts: true } }).render().asPng());
console.log('symbol box', BOX, 'files:', fs.readdirSync(OUT).join(' '));
