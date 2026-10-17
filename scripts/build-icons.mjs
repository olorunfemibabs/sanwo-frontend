#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
 * scripts/build-icons.mjs — favicon and app icons from the mark geometry
 *
 *   node scripts/build-icons.mjs
 *
 * Writes app/favicon.ico (16, 32, 48), app/icon.png (192) and
 * app/apple-icon.png (180). The 16px size uses the simplified mark: at that
 * size the outer lines blur into the S.
 * ───────────────────────────────────────────────────────────────────────── */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const BRAND = "#0f6e56";
const geo = JSON.parse(execFileSync("node", ["scripts/logo-geometry.mjs"]).toString());
const { paths, clipTop, clipBottom } = geo;

const full = ({ radius = 14, stroke = 4.6, scale = 0.8 } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<rect width="64" height="64" rx="${radius}" fill="${BRAND}"/>` +
  `<defs><clipPath id="t"><polygon points="${clipTop}"/></clipPath>` +
  `<clipPath id="b"><polygon points="${clipBottom}"/></clipPath></defs>` +
  `<g transform="translate(32 32) scale(${scale}) translate(-32 -32)" fill="none" stroke="#fff" stroke-width="${stroke}">` +
  `<path d="${paths.inner}"/>` +
  `<path d="${paths.outerTop}" clip-path="url(#t)"/>` +
  `<path d="${paths.outerBottom}" clip-path="url(#b)"/>` +
  `</g></svg>`;

const simple = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<rect width="64" height="64" rx="14" fill="${BRAND}"/>` +
  `<g transform="translate(32 32) scale(1.35) translate(-32 -32)" fill="none" stroke="#fff" stroke-width="7">` +
  `<path d="${paths.inner}"/></g></svg>`;

const png = (svg, size) => sharp(Buffer.from(svg), { density: 1200 }).resize(size, size).png().toBuffer();

/** An ICO file holding PNG images, which every current browser reads. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...images.map((im) => im.data)]);
}

const favicon = ico([
  { size: 16, data: await png(simple(), 16) },
  { size: 32, data: await png(full(), 32) },
  { size: 48, data: await png(full(), 48) },
]);
writeFileSync("app/favicon.ico", favicon);
writeFileSync("app/icon.png", await png(full({ stroke: 4.2, scale: 0.78 }), 192));
// iOS rounds the corners itself, so the apple icon is a full square.
writeFileSync("app/apple-icon.png", await png(full({ radius: 0, stroke: 4.2, scale: 0.74 }), 180));
console.log("Wrote app/favicon.ico, app/icon.png, app/apple-icon.png");
