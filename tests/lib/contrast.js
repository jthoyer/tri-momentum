'use strict';
// WCAG 2.x contrast from computed CSS colours. Colours with alpha are
// composited over the colour behind them first — a translucent white text on a
// translucent white card on a blue page is none of those three values.

function parse(c) {
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (!m) throw new Error('cannot parse colour: ' + c);
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}
function over(top, under) {
  const a = top.a;
  return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1 };
}
function lum(c) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function ratio(a, b) {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
// layers: computed colours from the furthest background to the nearest, then the foreground.
function ratioOf(fg, ...backgrounds) {
  let bg = parse(backgrounds[0]);
  for (const b of backgrounds.slice(1)) bg = over(parse(b), bg);
  return ratio(over(parse(fg), bg), bg);
}
module.exports = { parse, over, ratio, ratioOf };
