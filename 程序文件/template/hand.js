// 手账风动效工具：手绘描边自动画出 + 笔尖跟随 / 手写式文字揭示 / 粗糙荧光笔 / 和纸胶带 / 便利贴落下
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeBack = x => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const prog = (t, start, dur) => clamp((t - start) / dur);

// 可复现的伪随机
function rng(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

// 把折线加密到每 step 像素一个点，并加入手抖
function densify(pts, step = 6) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) out.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
  }
  return out;
}
function wobble(pts, amp, seed) {
  const r = rng(seed); let a = 0, b = 0;
  return pts.map(([x, y], i) => {           // 低频抖动：随机游走 + 衰减，像手画的线
    a = a * 0.85 + (r() - 0.5) * amp; b = b * 0.85 + (r() - 0.5) * amp;
    const e = Math.min(i, pts.length - 1 - i) < 2 ? 0.3 : 1;
    return [x + a * e, y + b * e];
  });
}
const lenOf = pts => pts.reduce((L, p, i) => i ? L + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0, 0);
const dOf = pts => 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');
function pointAt(pts, L) {                  // 沿线走 L 像素的位置与方向
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const s = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + s >= L) { const k = (L - acc) / (s || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k, Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])]; }
    acc += s;
  }
  const n = pts.length - 1; return [pts[n][0], pts[n][1], 0];
}

// 钢笔笔尖（尖端在 x,y）
function nib(x, y, o = 1) {
  return `<g opacity="${o}" transform="translate(${x} ${y}) rotate(-38)">
    <path d="M0 0 L-9 -26 L9 -26 Z" fill="#E9E2D4" stroke="#2B2B31" stroke-width="3" stroke-linejoin="round"/>
    <rect x="-11" y="-118" width="22" height="94" rx="9" fill="#2F3440" stroke="#16181E" stroke-width="3"/>
    <rect x="-11" y="-60" width="22" height="9" fill="#8FB8DE"/>
    <line x1="0" y1="-4" x2="0" y2="-18" stroke="#2B2B31" stroke-width="2"/></g>`;
}

// 手绘线条“画出来”：pts 为控制折线；返回 svg 和是否正在画（便于加笔尖/音效）
function drawOn(t, start, dur, pts, { w = 7, color = '#2B2B31', seed = 1, amp = 2.2, pen = true, ease = easeInOut } = {}) {
  const p = ease(prog(t, start, dur)); if (p <= 0) return '';
  const P = wobble(densify(pts), amp, seed), L = lenOf(P);
  let s = `<path d="${dOf(P)}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${L.toFixed(1)} ${(L + 10).toFixed(1)}" stroke-dashoffset="${(L * (1 - p)).toFixed(1)}"/>`;
  const after = t - (start + dur);
  if (pen && after < 0.25) { const [x, y] = pointAt(P, L * p); s += nib(x, y, after > 0 ? 1 - after / 0.25 : 1); }
  return s;
}

// 手绘圈（约 1.15 圈，首尾不闭合）
function circlePts(cx, cy, rx, ry, turns = 1.15, start = -2.3) {
  const n = 60, out = [];
  for (let k = 0; k <= n; k++) { const a = start + turns * 2 * Math.PI * k / n, g = 1 + 0.04 * Math.sin(k / 3); out.push([cx + rx * g * Math.cos(a), cy + ry * g * Math.sin(a)]); }
  return out;
}
// 弧形箭头：身体折线 + 两条箭头羽
function arrowParts(x1, y1, x2, y2, bend = -40) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + bend, body = [];
  for (let k = 0; k <= 16; k++) { const u = k / 16; body.push([(1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * mx + u * u * x2, (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * my + u * u * y2]); }
  const a = Math.atan2(y2 - body[14][1], x2 - body[14][0]), h = 26;
  return { body, head: [[x2 - h * Math.cos(a - 0.5), y2 - h * Math.sin(a - 0.5)], [x2, y2], [x2 - h * Math.cos(a + 0.5), y2 - h * Math.sin(a + 0.5)]] };
}
function drawArrow(t, start, dur, x1, y1, x2, y2, opt = {}) {
  const { body, head } = arrowParts(x1, y1, x2, y2, opt.bend ?? -40);
  return drawOn(t, start, dur * 0.75, body, { ...opt, pen: false }) + drawOn(t, start + dur * 0.75, dur * 0.25, head, { ...opt, amp: 0.8, pen: opt.pen !== false });
}

// 粗糙荧光笔：从左到右刷出，边缘不齐，略倾斜
function marker(t, start, dur, x, y, w, h, { color = '#FFD25E', seed = 3, opacity = 0.85, tilt = -1.2 } = {}) {
  const p = easeOut(prog(t, start, dur)); if (p <= 0) return '';
  const r = rng(seed), top = [], bot = [];
  for (let k = 0; k <= 12; k++) { const xx = x + w * k / 12; top.push([xx, y + (r() - 0.5) * h * 0.18]); bot.push([xx, y + h + (r() - 0.5) * h * 0.18]); }
  const poly = [[x - 6, y + h * 0.15], ...top, [x + w + 8, y + h * 0.5], ...bot.reverse(), [x - 4, y + h * 0.85]];
  const id = 'mk' + (marker.n = (marker.n || 0) + 1);
  return `<defs><clipPath id="${id}"><rect x="${x - 10}" y="${y - h}" width="${(w + 22) * p}" height="${h * 3}"/></clipPath></defs>
    <g clip-path="url(#${id})" transform="rotate(${tilt} ${x} ${y + h / 2})"><polygon points="${poly.map(q => q.join(',')).join(' ')}" fill="${color}" opacity="${opacity}"/></g>`;
}

// 手写式揭示：从左到右露出内容，笔尖沿边缘轻微上下移动
function writeOn(t, start, dur, x, y, w, h, body, { pen = true } = {}) {
  const p = prog(t, start, dur); if (p <= 0) return '';
  const id = 'wr' + (writeOn.n = (writeOn.n || 0) + 1);
  const ex = x + w * p;
  let s = `<defs><clipPath id="${id}"><rect x="${x - 20}" y="${y - h * 0.4}" width="${w * p + 20}" height="${h * 1.8}"/></clipPath></defs><g clip-path="url(#${id})">${body}</g>`;
  const after = t - (start + dur);
  if (pen && after < 0.25) s += nib(ex, y + h * 0.75 + Math.sin(t * 38) * h * 0.18, after > 0 ? 1 - after / 0.25 : 1);
  return s;
}

// 和纸胶带：半透明斜纹，两端锯齿；落下时略微缩放
function tape(t, start, cx, cy, w = 150, h = 40, angle = -6, color = '#8FB8DE') {
  const p = prog(t, start, 0.25); if (p <= 0) return '';
  const s = 1.25 - 0.25 * easeOut(p), r = rng(Math.round(cx + cy)), L = [], R = [];
  for (let k = 0; k <= 6; k++) { L.push([-w / 2 + (k % 2 ? 5 : 0) + (r() - 0.5) * 2, -h / 2 + h * k / 6]); R.push([w / 2 - (k % 2 ? 5 : 0) + (r() - 0.5) * 2, h / 2 - h * k / 6]); }
  const poly = [...L, ...R].map(q => q.join(',')).join(' ');
  return `<g opacity="${easeOut(p)}" transform="translate(${cx} ${cy}) rotate(${angle}) scale(${s})">
    <polygon points="${poly}" fill="${color}" opacity=".72"/>
    <polygon points="${poly}" fill="url(#tapeStripe)" opacity=".45"/></g>`;
}

// 便利贴：从上方落下、旋转回正、轻微回弹，顶部贴胶带
function sticky(t, start, cx, cy, w, h, body, { color = '#FFE38A', angle = -2.5 } = {}) {
  const p = prog(t, start, 0.5); if (p <= 0) return '';
  const e = easeBack(p), dy = (1 - e) * -70, rot = angle + (1 - e) * 9;
  return `<g opacity="${clamp(p * 3)}" transform="translate(${cx} ${cy + dy}) rotate(${rot})">
    <rect x="${-w / 2 + 6}" y="${-h / 2 + 8}" width="${w}" height="${h}" fill="#000" opacity=".08"/>
    <path d="M${-w / 2} ${-h / 2} H${w / 2} V${h / 2 - 18} L${w / 2 - 22} ${h / 2} H${-w / 2} Z" fill="${color}" stroke="#2B2B31" stroke-width="4" stroke-linejoin="round"/>
    <path d="M${w / 2} ${h / 2 - 18} L${w / 2 - 22} ${h / 2 - 16} L${w / 2 - 22} ${h / 2}" fill="#F2CF63" stroke="#2B2B31" stroke-width="3" stroke-linejoin="round"/>
    ${body}</g>` + tape(t, start + 0.4, cx, cy - h / 2 + dy, 130, 36, 4, '#8FB8DE');
}

const DEFS = `<pattern id="tapeStripe" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="14" fill="#fff"/></pattern>`;

module.exports = { clamp, easeOut, easeInOut, easeBack, prog, drawOn, drawArrow, circlePts, marker, writeOn, tape, sticky, nib, DEFS };
