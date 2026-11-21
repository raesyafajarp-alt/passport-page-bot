// passport-page-bot — main.ts
// Writes one invented passport spread to /output/entry.png.
// Pure Node 22, no dependencies, no network, fully deterministic:
// the same bytes come out on every run. The picture is drawn from
// scratch with a hand-authored stroke font and a tiny PNG encoder,
// so every word on the document is spelled exactly as written here.
//
// The document: the passport of the Republic of Velmora, a fictional
// island nation. Left page: data page (portrait, personal details,
// machine-readable zone, Coral Pact endorsement). Right page: visa
// page with entry/exit stamps whose dates all fall after the issue
// date, telling one coherent travel story.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ------------------------------------------------------------------
// Stroke font
// Every glyph is a list of strokes on a 9 x 13 grid (x 0..8, y 0..12,
// y grows downwards, cap height 12 units). Letters are drawn as
// clean single-weight strokes, like technical lettering, which reads
// as printed document type at small sizes. Only capitals are defined;
// lowercase input is upper-cased, as on a real passport.
// ------------------------------------------------------------------
type Pt = [number, number];
type Glyph = Pt[][];

const FONT: Record<string, Glyph> = {
  A: [[[0, 12], [4, 0], [8, 12]], [[2, 8], [6, 8]]],
  B: [[[0, 0], [0, 12]], [[0, 0], [6, 0], [8, 2], [8, 4], [6, 6], [0, 6]], [[0, 6], [6, 6], [8, 8], [8, 10], [6, 12], [0, 12]]],
  C: [[[8, 2], [6, 0], [2, 0], [0, 2], [0, 10], [2, 12], [6, 12], [8, 10]]],
  D: [[[0, 0], [0, 12]], [[0, 0], [6, 0], [8, 2], [8, 10], [6, 12], [0, 12]]],
  E: [[[8, 0], [0, 0], [0, 12], [8, 12]], [[0, 6], [6, 6]]],
  F: [[[8, 0], [0, 0], [0, 12]], [[0, 6], [6, 6]]],
  G: [[[8, 2], [6, 0], [2, 0], [0, 2], [0, 10], [2, 12], [6, 12], [8, 10], [8, 7], [5, 7]]],
  H: [[[0, 0], [0, 12]], [[8, 0], [8, 12]], [[0, 6], [8, 6]]],
  I: [[[4, 0], [4, 12]], [[1, 0], [7, 0]], [[1, 12], [7, 12]]],
  J: [[[8, 0], [8, 10], [6, 12], [2, 12], [0, 10]]],
  K: [[[0, 0], [0, 12]], [[8, 0], [0, 6], [8, 12]]],
  L: [[[0, 0], [0, 12], [8, 12]]],
  M: [[[0, 12], [0, 0], [4, 6], [8, 0], [8, 12]]],
  N: [[[0, 12], [0, 0], [8, 12], [8, 0]]],
  O: [[[6, 0], [2, 0], [0, 2], [0, 10], [2, 12], [6, 12], [8, 10], [8, 2], [6, 0]]],
  P: [[[0, 0], [0, 12]], [[0, 0], [6, 0], [8, 2], [8, 4], [6, 6], [0, 6]]],
  Q: [[[6, 0], [2, 0], [0, 2], [0, 10], [2, 12], [6, 12], [8, 10], [8, 2], [6, 0]], [[5, 8], [8, 12]]],
  R: [[[0, 0], [0, 12]], [[0, 0], [6, 0], [8, 2], [8, 4], [6, 6], [0, 6]], [[5, 6], [8, 12]]],
  S: [[[8, 2], [6, 0], [2, 0], [0, 2], [0, 5], [2, 6], [6, 6], [8, 8], [8, 10], [6, 12], [2, 12], [0, 10]]],
  T: [[[0, 0], [8, 0]], [[4, 0], [4, 12]]],
  U: [[[0, 0], [0, 10], [2, 12], [6, 12], [8, 10], [8, 0]]],
  V: [[[0, 0], [4, 12], [8, 0]]],
  W: [[[0, 0], [2, 12], [4, 6], [6, 12], [8, 0]]],
  X: [[[0, 0], [8, 12]], [[8, 0], [0, 12]]],
  Y: [[[0, 0], [4, 6], [8, 0]], [[4, 6], [4, 12]]],
  Z: [[[0, 0], [8, 0], [0, 12], [8, 12]]],
  "0": [[[6, 0], [2, 0], [0, 2], [0, 10], [2, 12], [6, 12], [8, 10], [8, 2], [6, 0]], [[2, 10], [6, 2]]],
  "1": [[[3, 0], [4, 0], [4, 12]], [[1, 12], [7, 12]]],
  "2": [[[0, 2], [2, 0], [6, 0], [8, 2], [8, 5], [0, 12], [8, 12]]],
  "3": [[[1, 0], [6, 0], [8, 2], [8, 4], [6, 6], [3, 6], [6, 6], [8, 8], [8, 10], [6, 12], [1, 12]]],
  "4": [[[0, 8], [6, 0], [6, 12]], [[0, 8], [8, 8]]],
  "5": [[[8, 0], [0, 0], [0, 6], [6, 6], [8, 8], [8, 10], [6, 12], [0, 12]]],
  "6": [[[8, 1], [5, 0], [2, 0], [0, 3], [0, 10], [2, 12], [6, 12], [8, 10], [8, 7], [5, 6], [2, 6], [0, 8]]],
  "7": [[[0, 0], [8, 0], [4, 12]]],
  "8": [[[2, 0], [6, 0], [8, 2], [8, 4], [6, 6], [2, 6], [0, 4], [0, 2], [2, 0]], [[2, 6], [6, 6], [8, 8], [8, 10], [6, 12], [2, 12], [0, 10], [0, 8], [2, 6]]],
  "9": [[[0, 2], [2, 0], [6, 0], [8, 2], [8, 6], [6, 6], [2, 6], [0, 4], [0, 2]], [[8, 6], [6, 12], [2, 12]]],
  " ": [],
  ".": [[[4, 11], [4, 12]]],
  ",": [[[4, 10], [4, 11], [3, 12]]],
  "-": [[[1, 6], [7, 6]]],
  "/": [[[7, 0], [1, 12]]],
  "<": [[[7, 1], [1, 6], [7, 11]]],
  ">": [[[1, 1], [7, 6], [1, 11]]],
  "(": [[[6, 0], [3, 2], [3, 10], [6, 12]]],
  ")": [[[2, 0], [5, 2], [5, 10], [2, 12]]],
  ":": [[[4, 4], [4, 5]], [[4, 9], [4, 10]]],
  "'": [[[4, 0], [4, 3]]],
  "+": [[[4, 2], [4, 10]], [[1, 6], [7, 6]]],
  "·": [[[4, 5], [4, 6]]],
};

const CHAR_ADVANCE = 10; // grid units per character cell (8 wide + 2 gap)

// ------------------------------------------------------------------
// Canvas: a plain RGBA pixel buffer with alpha-blended drawing.
// ------------------------------------------------------------------
type RGBA = [number, number, number, number];

class Canvas {
  readonly w: number;
  readonly h: number;
  readonly px: Uint8ClampedArray; // RGBA, row-major

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Uint8ClampedArray(w * h * 4);
  }

  set(x: number, y: number, c: RGBA): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    const i = (yi * this.w + xi) * 4;
    const a = c[3] / 255;
    if (a >= 1) {
      this.px[i] = c[0];
      this.px[i + 1] = c[1];
      this.px[i + 2] = c[2];
      this.px[i + 3] = 255;
    } else if (a > 0) {
      this.px[i] = Math.round(c[0] * a + this.px[i] * (1 - a));
      this.px[i + 1] = Math.round(c[1] * a + this.px[i + 1] * (1 - a));
      this.px[i + 2] = Math.round(c[2] * a + this.px[i + 2] * (1 - a));
      this.px[i + 3] = 255;
    }
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGBA): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.set(xx, yy, c);
    }
  }

  // Filled disc (used for thick lines and dots).
  disc(cx: number, cy: number, r: number, c: RGBA): void {
    const rr = Math.max(0, r);
    const x0 = Math.floor(cx - rr);
    const x1 = Math.ceil(cx + rr);
    const y0 = Math.floor(cy - rr);
    const y1 = Math.ceil(cy + rr);
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - cx;
        const dy = yy + 0.5 - cy;
        if (dx * dx + dy * dy <= rr * rr + 0.5) this.set(xx, yy, c);
      }
    }
  }

  // Thick line between two points, round caps.
  line(x0: number, y0: number, x1: number, y1: number, width: number, c: RGBA): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len * 2));
    const r = Math.max(0.5, width / 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      this.disc(x0 + dx * t, y0 + dy * t, r, c);
    }
  }

  polyline(points: Pt[], width: number, c: RGBA, close = false): void {
    for (let i = 0; i + 1 < points.length; i++) {
      this.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], width, c);
    }
    if (close && points.length > 2) {
      this.line(points[points.length - 1][0], points[points.length - 1][1], points[0][0], points[0][1], width, c);
    }
  }

  circleOutline(cx: number, cy: number, r: number, width: number, c: RGBA): void {
    const steps = Math.max(24, Math.ceil(2 * Math.PI * r));
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * 2 * Math.PI;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      this.disc(x, y, Math.max(0.5, width / 2), c);
    }
  }

  // Filled ellipse.
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA): void {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const dx = (xx + 0.5 - cx) / rx;
        const dy = (yy + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(xx, yy, c);
      }
    }
  }

  // Filled polygon, even-odd scanline fill.
  polygon(points: Pt[], c: RGBA): void {
    if (points.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          const t = (y + 0.5 - a[1]) / (b[1] - a[1]);
          xs.push(a[0] + t * (b[0] - a[0]));
        }
      }
      xs.sort((m, n) => m - n);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) this.set(x, y, c);
      }
    }
  }

  // Gentle sine wave line (guilloche), drawn as a thin polyline.
  wave(x0: number, x1: number, yBase: number, amp: number, period: number, phase: number, c: RGBA): void {
    const pts: Pt[] = [];
    for (let x = x0; x <= x1; x += 3) {
      pts.push([x, yBase + Math.sin((x / period) * 2 * Math.PI + phase) * amp]);
    }
    this.polyline(pts, 1, c);
  }
}

// ------------------------------------------------------------------
// Text rendering with the stroke font.
// ------------------------------------------------------------------
function textWidth(text: string, scale: number, tracking = 0): number {
  const s = text.toUpperCase();
  if (s.length === 0) return 0;
  return s.length * CHAR_ADVANCE * scale + (s.length - 1) * tracking;
}

interface TextOpts {
  align?: "left" | "center" | "right";
  tracking?: number; // extra px between characters
  weight?: number; // stroke width in px; default scales with size
}

function drawText(cv: Canvas, text: string, x: number, y: number, scale: number, color: RGBA, opts: TextOpts = {}): void {
  const s = text.toUpperCase();
  const tracking = opts.tracking ?? 0;
  const w = textWidth(s, scale, tracking);
  let cx = x;
  if (opts.align === "center") cx = x - w / 2;
  if (opts.align === "right") cx = x - w;
  const weight = opts.weight ?? Math.max(1, Math.ceil(scale * 0.55));
  for (const ch of s) {
    const glyph = FONT[ch];
    if (glyph) {
      for (const stroke of glyph) {
        const pts: Pt[] = stroke.map(([gx, gy]) => [cx + gx * scale, y + gy * scale]);
        cv.polyline(pts, weight, color);
      }
    }
    cx += CHAR_ADVANCE * scale + tracking;
  }
}

// Blit a small canvas onto this one, rotated by angleDeg around its
// centre, placed at (cx, cy), with an extra global alpha 0..1.
function blitRotated(dst: Canvas, src: Canvas, cx: number, cy: number, angleDeg: number, alpha: number): void {
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const hw = src.w / 2;
  const hh = src.h / 2;
  const r = Math.hypot(hw, hh);
  const x0 = Math.floor(cx - r);
  const x1 = Math.ceil(cx + r);
  const y0 = Math.floor(cy - r);
  const y1 = Math.ceil(cy + r);
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      const dx = xx + 0.5 - cx;
      const dy = yy + 0.5 - cy;
      // Inverse rotation: source coords of this destination pixel.
      const sx = cos * dx + sin * dy + hw;
      const sy = -sin * dx + cos * dy + hh;
      const sxi = Math.floor(sx);
      const syi = Math.floor(sy);
      if (sxi < 0 || syi < 0 || sxi >= src.w || syi >= src.h) continue;
      const i = (syi * src.w + sxi) * 4;
      const sa = (src.px[i + 3] / 255) * alpha;
      if (sa <= 0) continue;
      dst.set(xx, yy, [src.px[i], src.px[i + 1], src.px[i + 2], Math.round(sa * 255)]);
    }
  }
}

// ------------------------------------------------------------------
// Portrait: a flat-illustration passport photo, drawn with shapes.
// ------------------------------------------------------------------
function drawPortrait(cv: Canvas, x: number, y: number, w: number, h: number): void {
  // Photo background: soft vertical gradient, light blue-grey.
  for (let yy = 0; yy < h; yy++) {
    const t = yy / h;
    const r = Math.round(200 + (168 - 200) * t);
    const g = Math.round(210 + (184 - 210) * t);
    const b = Math.round(218 + (194 - 218) * t);
    cv.fillRect(x, y + yy, w, 1, [r, g, b, 255]);
  }
  const cx = x + w / 2;
  const skin: RGBA = [217, 169, 134, 255];
  const skinDark: RGBA = [198, 148, 112, 255];
  const hair: RGBA = [46, 33, 25, 255];
  const navy: RGBA = [43, 58, 85, 255];
  const shoulderY = y + h - 4;
  // Shoulders (dark navy top).
  cv.polygon(
    [
      [x, shoulderY],
      [x, y + h * 0.74],
      [cx - w * 0.26, y + h * 0.66],
      [cx + w * 0.26, y + h * 0.66],
      [x + w, y + h * 0.74],
      [x + w, shoulderY],
    ],
    navy
  );
  // Neck.
  cv.fillRect(cx - 11, y + h * 0.52, 22, h * 0.18, skinDark);
  // Hair behind the head (tied back) and a small bun.
  cv.ellipse(cx, y + h * 0.36, w * 0.31, h * 0.3, hair);
  cv.disc(cx + w * 0.23, y + h * 0.26, 8, hair); // bun, tucked into the hair mass
  // Head.
  cv.ellipse(cx, y + h * 0.38, w * 0.24, h * 0.23, skin);
  // Hair cap over the top of the head, side locks.
  cv.ellipse(cx, y + h * 0.2, w * 0.26, h * 0.16, hair);
  cv.ellipse(cx - w * 0.24, y + h * 0.42, 6, h * 0.16, hair);
  cv.ellipse(cx + w * 0.24, y + h * 0.42, 6, h * 0.16, hair);
  // Face: brows, eyes, nose, mouth.
  const dark: RGBA = [40, 30, 24, 255];
  cv.line(cx - 22, y + h * 0.34, cx - 10, y + h * 0.325, 2, dark);
  cv.line(cx + 10, y + h * 0.325, cx + 22, y + h * 0.34, 2, dark);
  cv.disc(cx - 16, y + h * 0.375, 2.5, dark);
  cv.disc(cx + 16, y + h * 0.375, 2.5, dark);
  cv.line(cx - 1, y + h * 0.4, cx - 3, y + h * 0.47, 2, skinDark);
  cv.polyline(
    [
      [cx - 11, y + h * 0.53],
      [cx, y + h * 0.545],
      [cx + 11, y + h * 0.53],
    ],
    2,
    [150, 90, 70, 255]
  );
  // Soft cheek shading.
  cv.ellipse(cx - 20, y + h * 0.47, 7, 4, [226, 182, 150, 90]);
  cv.ellipse(cx + 20, y + h * 0.47, 7, 4, [226, 182, 150, 90]);
  // Frame: dark outer line, thin white inner line.
  cv.polyline(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y],
    ],
    3,
    [29, 42, 74, 255]
  );
}

// ------------------------------------------------------------------
// Coat of arms: a lighthouse above waves inside a double circle.
// ------------------------------------------------------------------
function drawCoatOfArms(cv: Canvas, cx: number, cy: number, r: number): void {
  const navy: RGBA = [29, 42, 74, 255];
  const gold: RGBA = [176, 141, 46, 255];
  cv.circleOutline(cx, cy, r, 2, gold);
  cv.circleOutline(cx, cy, r - 6, 1, navy);
  // Light rays from the lamp.
  cv.line(cx, cy - r * 0.62, cx - r * 0.52, cy - r * 0.78, 2, gold);
  cv.line(cx, cy - r * 0.62, cx + r * 0.52, cy - r * 0.78, 2, gold);
  cv.line(cx, cy - r * 0.62, cx, cy - r * 0.86, 2, gold);
  // Lamp room.
  cv.fillRect(cx - 7, cy - r * 0.66, 14, 9, gold);
  // Tower.
  cv.polygon(
    [
      [cx - 8, cy + r * 0.32],
      [cx - 5, cy - r * 0.5],
      [cx + 5, cy - r * 0.5],
      [cx + 8, cy + r * 0.32],
    ],
    navy
  );
  // Tower bands.
  cv.line(cx - 7, cy - r * 0.18, cx + 7, cy - r * 0.18, 2, [246, 241, 224, 255]);
  cv.line(cx - 8, cy + r * 0.08, cx + 8, cy + r * 0.08, 2, [246, 241, 224, 255]);
  // Waves.
  cv.polyline(
    [
      [cx - r * 0.6, cy + r * 0.48],
      [cx - r * 0.3, cy + r * 0.4],
      [cx, cy + r * 0.48],
      [cx + r * 0.3, cy + r * 0.4],
      [cx + r * 0.6, cy + r * 0.48],
    ],
    2,
    navy
  );
  cv.polyline(
    [
      [cx - r * 0.45, cy + r * 0.66],
      [cx - r * 0.2, cy + r * 0.58],
      [cx + r * 0.05, cy + r * 0.66],
      [cx + r * 0.3, cy + r * 0.58],
      [cx + r * 0.5, cy + r * 0.66],
    ],
    2,
    navy
  );
  // Two small stars flanking the tower.
  for (const sx of [cx - r * 0.68, cx + r * 0.68]) {
    cv.line(sx - 4, cy - r * 0.1, sx + 4, cy - r * 0.1, 2, gold);
    cv.line(sx, cy - r * 0.1 - 4, sx, cy - r * 0.1 + 4, 2, gold);
  }
}

// ------------------------------------------------------------------
// Stamps: drawn onto small offscreen canvases, then rotated onto the
// page with translucent ink, like a real rubber stamp.
// ------------------------------------------------------------------
function roundStamp(lines: { text: string; scale: number }[], color: RGBA, radius: number): Canvas {
  const size = radius * 2 + 16;
  const cv = new Canvas(size, size);
  const cx = size / 2;
  const cy = size / 2;
  cv.circleOutline(cx, cy, radius, 3, color);
  cv.circleOutline(cx, cy, radius - 9, 1, color);
  const totalH = lines.length * 21;
  let y = cy - totalH / 2 + 2;
  for (const ln of lines) {
    drawText(cv, ln.text, cx, y, ln.scale, color, { align: "center" });
    y += 21;
  }
  return cv;
}

function rectStamp(lines: { text: string; scale: number }[], color: RGBA, w: number, h: number): Canvas {
  const cv = new Canvas(w + 16, h + 16);
  cv.polyline(
    [
      [6, 6],
      [w + 10, 6],
      [w + 10, h + 10],
      [6, h + 10],
      [6, 6],
    ],
    3,
    color
  );
  cv.polyline(
    [
      [11, 11],
      [w + 5, 11],
      [w + 5, h + 5],
      [11, h + 5],
      [11, 11],
    ],
    1,
    color
  );
  const totalH = lines.length * 22;
  let y = (h + 16) / 2 - totalH / 2 + 3;
  for (const ln of lines) {
    drawText(cv, ln.text, (w + 16) / 2, y, ln.scale, color, { align: "center" });
    y += 22;
  }
  return cv;
}

// ------------------------------------------------------------------
// The spread.
// ------------------------------------------------------------------
const INK: RGBA = [29, 42, 74, 255];
const BODY: RGBA = [32, 36, 44, 255];
const LABEL: RGBA = [90, 95, 102, 255];
const CREAM: RGBA = [246, 241, 224, 255];
const CREAM2: RGBA = [247, 243, 228, 255];

function guilloche(cv: Canvas, x0: number, x1: number, ys: number[]): void {
  const faint: RGBA = [29, 42, 74, 14];
  ys.forEach((y, i) => cv.wave(x0, x1, y, 4, 46, i * 1.7, faint));
}

function drawSpread(): Canvas {
  const cv = new Canvas(1024, 1024);
  // Desk.
  cv.fillRect(0, 0, 1024, 1024, [36, 40, 44, 255]);
  // Soft shadow under the book.
  cv.ellipse(512, 862, 470, 14, [0, 0, 0, 60]);

  // Cover: dark teal, gold border, visible as a rim around the pages.
  cv.fillRect(52, 170, 920, 684, [18, 63, 71, 255]);
  cv.polyline(
    [
      [60, 178],
      [964, 178],
      [964, 846],
      [60, 846],
      [60, 178],
    ],
    2,
    [201, 162, 39, 255]
  );

  // Pages.
  const pageL = { x: 68, y: 186, w: 432, h: 652 };
  const pageR = { x: 524, y: 186, w: 432, h: 652 };
  cv.fillRect(pageL.x, pageL.y, pageL.w, pageL.h, CREAM);
  cv.fillRect(pageR.x, pageR.y, pageR.w, pageR.h, CREAM2);
  // Spine shadow.
  cv.fillRect(498, 186, 4, 652, [0, 0, 0, 40]);
  cv.fillRect(522, 186, 4, 652, [0, 0, 0, 25]);
  guilloche(cv, pageR.x + 14, pageR.x + pageR.w - 14, [250, 470, 660]);

  // ---- Data page (left) ----
  drawText(cv, "No. VEL 123 456", 488, 198, 1.05, LABEL, { align: "right" });
  drawCoatOfArms(cv, 284, 240, 44);
  drawText(cv, "REPUBLIC OF VELMORA", 284, 300, 1.9, INK, { align: "center", tracking: 1 });
  drawText(cv, "PASSPORT", 284, 328, 1.6, INK, { align: "center", tracking: 7 });
  cv.line(100, 356, 468, 356, 2, INK);
  cv.line(100, 361, 468, 361, 1, INK);

  // Portrait.
  drawPortrait(cv, 92, 382, 140, 186);

  // Personal data: label above value, one row per field.
  const fields: [string, string][] = [
    ["SURNAME", "VOSS"],
    ["GIVEN NAMES", "ELENA MARIS"],
    ["NATIONALITY", "VELMORAN"],
    ["DATE OF BIRTH", "14 MAR 1987"],
    ["PLACE OF BIRTH", "PORT AURELIA"],
    ["DATE OF ISSUE", "02 JUN 2026"],
    ["DATE OF EXPIRY", "02 JUN 2036"],
  ];
  let fy = 376;
  for (const [label, value] of fields) {
    drawText(cv, label, 256, fy, 1.0, LABEL);
    drawText(cv, value, 256, fy + 14, 1.3, BODY);
    fy += 32;
  }
  drawText(cv, "SEX", 92, 578, 1.0, LABEL);
  drawText(cv, "F", 92, 589, 1.5, BODY);
  drawText(cv, "AUTHORITY", 92, 614, 1.0, LABEL);
  drawText(cv, "PORT AURELIA", 92, 625, 1.4, BODY);

  // Coral Pact endorsement stamp, lower right of the data page.
  const endorse = rectStamp(
    [
      { text: "CORAL PACT", scale: 1.4 },
      { text: "NO VISA REQUIRED", scale: 0.9 },
      { text: "90 DAYS", scale: 0.9 },
    ],
    [31, 78, 156, 255],
    190,
    56
  );
  blitRotated(cv, endorse, 360, 660, -5, 0.85);

  // Machine-readable zone on a pale band.
  cv.fillRect(84, 706, 408, 62, [251, 248, 236, 255]);
  cv.line(84, 706, 492, 706, 1, [29, 42, 74, 90]);
  drawText(cv, "P<VELVOSS<<ELENA<MARIS<<<<<<<<<<<<<<<", 92, 716, 0.95, BODY);
  drawText(cv, "VEL12345678VEL8703149F3606027<<<<<<<<04", 92, 740, 0.95, BODY);
  drawText(cv, "LANGUAGES: VELMORIAN · ENGLISH · FRENCH", 92, 812, 0.95, LABEL);

  // ---- Visa page (right) ----
  drawText(cv, "VISAS", 740, 200, 1.9, INK, { align: "center", tracking: 9 });
  cv.line(560, 230, 920, 230, 1, INK);

  const stampBlue: RGBA = [31, 78, 156, 255];
  const stampGreen: RGBA = [30, 122, 70, 255];
  const stampPurple: RGBA = [106, 61, 154, 255];
  const stampRed: RGBA = [176, 42, 42, 255];

  blitRotated(
    cv,
    roundStamp(
      [
        { text: "TARNOVIA", scale: 1.25 },
        { text: "ARRIVED", scale: 1.1 },
        { text: "18 JUL 2026", scale: 0.95 },
      ],
      stampBlue,
      66
    ),
    648,
    356,
    -12,
    0.82
  );
  blitRotated(
    cv,
    rectStamp(
      [
        { text: "KETHRA", scale: 1.6 },
        { text: "DEPARTED", scale: 1.2 },
        { text: "02 AUG 2026", scale: 1.2 },
      ],
      stampGreen,
      180,
      84
    ),
    840,
    340,
    7,
    0.82
  );
  blitRotated(
    cv,
    roundStamp(
      [
        { text: "SARN", scale: 1.5 },
        { text: "ENTRY", scale: 1.15 },
        { text: "11 SEP 2026", scale: 0.9 },
      ],
      stampPurple,
      60
    ),
    688,
    566,
    5,
    0.82
  );
  blitRotated(
    cv,
    rectStamp(
      [
        { text: "DEPARTURE TAX", scale: 1.0 },
        { text: "40 VLR - PAID", scale: 1.2 },
      ],
      stampRed,
      170,
      56
    ),
    848,
    576,
    -6,
    0.82
  );
  blitRotated(
    cv,
    rectStamp(
      [
        { text: "VELMORA", scale: 1.5 },
        { text: "EXIT 14 SEP 2026", scale: 1.0 },
      ],
      stampBlue,
      190,
      62
    ),
    668,
    728,
    -4,
    0.82
  );
  drawText(cv, "12", 940, 812, 1.1, LABEL, { align: "right" });
  return cv;
}

// ------------------------------------------------------------------
// Minimal PNG encoder (8-bit RGBA, no filtering, zlib level 9).
// ------------------------------------------------------------------
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(cv: Canvas): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0);
  ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const stride = cv.w * 4;
  const raw = Buffer.alloc((stride + 1) * cv.h);
  for (let y = 0; y < cv.h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(cv.px.buffer, cv.px.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------
// Entry point.
// ------------------------------------------------------------------
function main(): void {
  const out = process.argv[2] ?? "/output/entry.png";
  const png = encodePNG(drawSpread());
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes, 1024x1024)`);
}

main();
