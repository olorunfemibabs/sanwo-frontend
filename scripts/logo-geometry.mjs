#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
 * scripts/logo-geometry.mjs — the Sanwo mark, built from geometry
 *
 * Two arcs and an S: a complete centre-line S, plus two outer lines offset
 * from it. One wraps the top bowl, the other the bottom bowl, and each stops
 * on the vertical centre line: money going out, and coming back.
 *
 * Bowls are true concentric arcs. The spine is a cubic Bézier, and its
 * offsets use the Tiller–Hanson construction, which is exact for the
 * straight control-polygon legs and very close for this gentle curve.
 *
 *   node scripts/logo-geometry.mjs        prints path data and writes the SVGs
 * ───────────────────────────────────────────────────────────────────────── */

import { mkdirSync, writeFileSync } from "node:fs";

// 64-unit grid, proportions measured from the approved concept.
const CX = 32;
const TOP = 22.6; // top bowl centre (y)
const BOT = 41.4; // bottom bowl centre (y)
const R = 10.4; // centre-line radius
const D = 7.6; // offset of the outer lines
const W = 3.8; // stroke width
const K = 8.2; // spine handle length

const f = (n) => Number(n.toFixed(3));
const pt = (p) => `${f(p[0])} ${f(p[1])}`;

/** Offset a cubic (vertical end tangents, symmetric S) by distance d to its left. */
function offsetCubic([p0, p1, p2, p3], d) {
  const norm = (a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy);
    return [dy / l, -dx / l]; // left normal for a y-down screen
  };
  const shift = (a, b, n) => [
    [a[0] + n[0] * d, a[1] + n[1] * d],
    [b[0] + n[0] * d, b[1] + n[1] * d],
  ];
  const intersect = ([a1, a2], [b1, b2]) => {
    const d1 = [a2[0] - a1[0], a2[1] - a1[1]];
    const d2 = [b2[0] - b1[0], b2[1] - b1[1]];
    const den = d1[0] * d2[1] - d1[1] * d2[0];
    const t = ((b1[0] - a1[0]) * d2[1] - (b1[1] - a1[1]) * d2[0]) / den;
    return [a1[0] + d1[0] * t, a1[1] + d1[1] * t];
  };
  const e1 = shift(p0, p1, norm(p0, p1));
  const e2 = shift(p1, p2, norm(p1, p2));
  const e3 = shift(p2, p3, norm(p2, p3));
  return [e1[0], intersect(e1, e2), intersect(e2, e3), e3[1]];
}

/** Split a cubic at t (de Casteljau). */
function split(c, t) {
  const lerp = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const [a, b, cc, d] = c;
  const ab = lerp(a, b), bc = lerp(b, cc), cd = lerp(cc, d);
  const abc = lerp(ab, bc), bcd = lerp(bc, cd);
  const m = lerp(abc, bcd);
  return [[a, ab, abc, m], [m, bcd, cd, d]];
}
const at = (c, t) => {
  const mt = 1 - t;
  return [0, 1].map((i) => mt ** 3 * c[0][i] + 3 * mt * mt * t * c[1][i] + 3 * mt * t * t * c[2][i] + t ** 3 * c[3][i]);
};
/** Parameter where the curve crosses a given x. */
function tAtX(c, x) {
  let lo = 0, hi = 1;
  const rising = at(c, 1)[0] > at(c, 0)[0];
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if ((at(c, mid)[0] < x) === rising) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Centre-line spine: from the left of the top bowl down to the right of the bottom bowl.
const spine = [
  [CX - R, TOP],
  [CX - R, TOP + K],
  [CX + R, BOT - K],
  [CX + R, BOT],
];

// Inner S: top bowl (right terminal, over the top), spine, bottom bowl (under, to the left terminal).
const inner =
  `M${pt([CX + R, TOP])}` +
  `A${R} ${R} 0 0 0 ${pt([CX - R, TOP])}` +
  `C${pt(spine[1])} ${pt(spine[2])} ${pt(spine[3])}` +
  `A${R} ${R} 0 0 1 ${pt([CX - R, BOT])}`;

// Outer top line: outer top bowl, then the spine offset on the outside, cut at the centre.
const outerSpineA = offsetCubic(spine, -D); // right of travel = outside of the top bowl
// Run a little past the centre; a clip trims it to a clean vertical cut on x = CX.
const [headA] = split(outerSpineA, tAtX(outerSpineA, CX + W));
const outerTop =
  `M${pt([CX + R + D, TOP])}` +
  `A${R + D} ${R + D} 0 0 0 ${pt([CX - R - D, TOP])}` +
  `C${pt(headA[1])} ${pt(headA[2])} ${pt(headA[3])}`;

// Outer bottom line: mirror of the top one through the centre point.
const mirror = (p) => [2 * CX - p[0], TOP + BOT - p[1]];
const outerBottom =
  `M${pt(mirror([CX + R + D, TOP]))}` +
  `A${R + D} ${R + D} 0 0 0 ${pt(mirror([CX - R - D, TOP]))}` +
  `C${pt(mirror(headA[1]))} ${pt(mirror(headA[2]))} ${pt(mirror(headA[3]))}`;

const paths = { inner, outerTop, outerBottom };

// Clips: keep each outer bowl whole, and cut its spine end on the centre line.
const clipTop = `0,0 64,0 64,${TOP + 1} ${CX},${TOP + 1} ${CX},64 0,64`;
const clipBottom = `64,64 0,64 0,${BOT - 1} ${CX},${BOT - 1} ${CX},0 64,0`;
const markSvg = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<defs><clipPath id="l"><polygon points="${clipTop}"/></clipPath>` +
  `<clipPath id="r"><polygon points="${clipBottom}"/></clipPath></defs>` +
  `<g fill="none" stroke="${color}" stroke-width="${W}">` +
  `<path d="${inner}"/>` +
  `<path d="${outerTop}" clip-path="url(#l)"/>` +
  `<path d="${outerBottom}" clip-path="url(#r)"/>` +
  `</g></svg>`;

mkdirSync("design/logo", { recursive: true });
writeFileSync("design/logo/sanwo-mark.svg", markSvg("#0f6e56"));
writeFileSync("design/logo/sanwo-mark-ink.svg", markSvg("#1b1f22"));
writeFileSync("design/logo/sanwo-mark-white.svg", markSvg("#ffffff"));

console.log(JSON.stringify({ strokeWidth: W, paths, clipTop, clipBottom }, null, 2));
