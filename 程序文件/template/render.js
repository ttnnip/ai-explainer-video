// 讲解视频渲染：script.json + build/timeline.json → build/video_noaudio.mp4 + build/sfx.json
// 画面：米色点阵纸 + 顶部进度条 + 左上栏目/章节 + 中间讲解动画 + 右下虚拟形象 + 底部关键词高亮字幕
// 用法：node render.js            出整片
//       node render.js 2,6,10    只出这几秒的静帧（build/still_秒.png），先检查再出片
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Resvg } = require('@resvg/resvg-js');
const { renderAvatar, lipSync } = require('../avatar/avatar.js');
const { drawOn, drawArrow, circlePts, marker, writeOn, tape, sticky, easeInOut, DEFS } = require('./hand.js');

const W = 1920, H = 1080;
const HERE = __dirname, B = process.env.BUILD_DIR || path.join(HERE, 'build');
const script = JSON.parse(fs.readFileSync(process.env.SCRIPT_JSON || path.join(HERE, 'script.json'), 'utf8').replace(/^﻿/, ''));
const tl = JSON.parse(fs.readFileSync(path.join(B, 'timeline.json'), 'utf8'));
const FPS = tl.fps, N = Math.round(tl.duration * FPS);
const MOUTHS = lipSync(tl.level, tl.fps, tl.spans);
const ONLY = process.argv[2] ? process.argv[2].split(',').map(Number) : null;

// ---------- 字体（自动找系统中文字体，也可用环境变量 FONT_FILES / FONT_FAMILY 指定） ----------
const FONT_CANDIDATES = [
  { family: 'Microsoft YaHei', files: ['C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/msyhbd.ttc'] },
  { family: 'PingFang SC', files: ['/System/Library/Fonts/PingFang.ttc'] },
  { family: 'Hiragino Sans GB', files: ['/System/Library/Fonts/Hiragino Sans GB.ttc'] },
  { family: 'Noto Sans CJK SC', files: ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc'] },
];
let FONT = process.env.FONT_FAMILY, FONT_FILES = process.env.FONT_FILES ? process.env.FONT_FILES.split(',') : null;
if (!FONT_FILES) {
  const hit = FONT_CANDIDATES.find(c => c.files.some(f => fs.existsSync(f)));
  if (hit) { FONT = FONT || hit.family; FONT_FILES = hit.files.filter(f => fs.existsSync(f)); }
}
FONT = FONT || 'sans-serif';
const fontOpts = { fontFiles: FONT_FILES || [], loadSystemFonts: !FONT_FILES, defaultFontFamily: FONT };

// ---------- 设计规范（改这里就能换配色） ----------
const C = { bg: '#F4EEE3', dot: '#DCD2C2', ink: '#2B2B31', sub: '#6B6258', accent: '#8FB8DE', accentDk: '#4F86B8', hl: '#FFD25E', card: '#FFFFFF', red: '#E0665A', green: '#4FA77A' };
const CHANNEL = script.channel || 'AI 小课堂';

// ---------- 动画工具 ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeBack = x => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const prog = (t, start, dur = 0.35) => clamp((t - start) / dur);
function pop(t, start, cx, cy, body, dur = 0.4) {
  const p = prog(t, start, dur); if (p <= 0) return '';
  return `<g opacity="${easeOut(p)}" transform="translate(${cx} ${cy}) scale(${easeBack(p)}) translate(${-cx} ${-cy})">${body}</g>`;
}
function rise(t, start, body, dist = 30, dur = 0.4) {
  const p = prog(t, start, dur); if (p <= 0) return '';
  return `<g opacity="${easeOut(p)}" transform="translate(0 ${(1 - easeOut(p)) * dist})">${body}</g>`;
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const tw = (s, size) => [...String(s)].reduce((w, ch) => w + (/[\x00-\x7F]/.test(ch) ? size * 0.56 : size), 0);
const text = (x, y, s, size, fill = C.ink, weight = 'bold', anchor = 'start') =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;
// 文字太长时自动缩小字号，保证不超出 maxW
const fit = (s, size, maxW) => Math.min(size, Math.floor(size * maxW / Math.max(1, tw(s, size))));

// 关键词在第 i 句里被说出的时间（按字数比例估算）
function kwTime(i, kw) {
  const ln = script.lines[i], [a, b] = tl.spans[i];
  const k = kw ? ln.text.indexOf(kw) : -1;
  return k < 0 ? a + 0.3 : a + (b - a) * (k / ln.text.length) - 0.1;
}
const spanOf = i => tl.spans[i];
const sceneStart = i => i === 0 ? 0 : tl.spans[i][0] - 0.15;

// ---------- 音效事件 ----------
const sfx = [];
const addSfx = (t, kind, d) => { if (!sfx.some(e => Math.abs(e.t - t) < 0.05 && e.kind === kind)) sfx.push({ t: +t.toFixed(3), kind, ...(d ? { d } : {}) }); };

// ---------- 场景库：每个场景的文字都来自 script.json 里该句的 data ----------
const CX = 760; // 内容区中心（右侧留给形象）
const ICONS = {
  target: (x, y) => `<circle cx="${x}" cy="${y}" r="70" fill="#fff" stroke="${C.ink}" stroke-width="7"/><circle cx="${x}" cy="${y}" r="44" fill="${C.accent}" stroke="${C.ink}" stroke-width="6"/><circle cx="${x}" cy="${y}" r="16" fill="${C.ink}"/>`,
  steps: (x, y) => [0, 1, 2].map(j => `<rect x="${x - 70 + j * 18}" y="${y - 65 + j * 45}" width="${140 - j * 36}" height="32" rx="9" fill="${j === 0 ? C.accent : '#fff'}" stroke="${C.ink}" stroke-width="6"/>`).join(''),
  check: (x, y) => `<circle cx="${x}" cy="${y}" r="70" fill="${C.green}" stroke="${C.ink}" stroke-width="7"/>`,
  idea: (x, y) => `<circle cx="${x}" cy="${y - 12}" r="52" fill="${C.hl}" stroke="${C.ink}" stroke-width="7"/><rect x="${x - 24}" y="${y + 36}" width="48" height="30" rx="6" fill="#fff" stroke="${C.ink}" stroke-width="6"/>`,
  chat: (x, y) => `<path d="M${x - 70} ${y - 50} h140 a16 16 0 0 1 16 16 v62 a16 16 0 0 1 -16 16 h-80 l-30 26 v-26 h-30 a16 16 0 0 1 -16 -16 v-62 a16 16 0 0 1 16 -16z" fill="#fff" stroke="${C.ink}" stroke-width="7"/><g fill="${C.ink}"><circle cx="${x - 34}" cy="${y - 3}" r="8"/><circle cx="${x}" cy="${y - 3}" r="8"/><circle cx="${x + 34}" cy="${y - 3}" r="8"/></g>`,
  code: (x, y) => `<rect x="${x - 78}" y="${y - 60}" width="156" height="120" rx="14" fill="${C.ink}"/><path d="M${x - 40} ${y - 18} l-24 18 l24 18 M${x + 40} ${y - 18} l24 18 l-24 18" fill="none" stroke="${C.hl}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
};
const SCENES = {
  // 开场：一行小字手写出来 + 大关键词弹出 + 手绘圈住
  hook(t, i, d) {
    const [a] = spanOf(i), tk = kwTime(i, d.big);
    const sub = d.sub || '', ss = fit(sub, 64, 1150), sw = tw(sub, ss);
    const big = d.big || '', bs = fit(big, 230, 1100), bw = tw(big, bs);
    addSfx(a + 0.1, 'scribble', 0.9); addSfx(tk, 'pop'); addSfx(tk + 0.55, 'scribble', 0.6);
    let s = sub ? writeOn(t, a + 0.1, 0.9, CX - sw / 2, 300, sw, ss, text(CX, 360, sub, ss, C.sub, 'bold', 'middle')) : '';
    s += marker(t, tk + 0.15, 0.35, CX - bw / 2 - 10, 548, bw + 20, 64, { color: C.accent, opacity: 0.7, seed: 5 });
    s += pop(t, tk, CX, 520, text(CX, 600, big, bs, C.ink, 'bold', 'middle'), 0.45);
    s += drawOn(t, tk + 0.55, 0.6, circlePts(CX, 527, bw / 2 + 70, 128), { w: 8, seed: 7, amp: 3 });
    return s;
  },
  // 定义：一本“书”弹出 + “术语 =” 手写 + “前缀 + 定义”荧光标出 + 箭头连起来
  define(t, i, d) {
    const [a] = spanOf(i), tk = kwTime(i, d.def);
    addSfx(a + 0.25, 'pop'); addSfx(a + 0.5, 'scribble', 0.6); addSfx(tk, 'pop'); addSfx(tk + 0.45, 'scribble', 0.5);
    const cover = d.cover || String(d.term || '').toUpperCase().slice(0, 8);
    const book = `<g><rect x="250" y="300" width="300" height="380" rx="22" fill="${C.accent}" stroke="${C.ink}" stroke-width="7"/>
      <rect x="250" y="300" width="46" height="380" rx="16" fill="${C.accentDk}" stroke="${C.ink}" stroke-width="7"/>
      <rect x="330" y="370" width="180" height="70" rx="12" fill="#fff" stroke="${C.ink}" stroke-width="5"/>
      ${text(420, 418, cover, fit(cover, 38, 160), C.ink, 'bold', 'middle')}</g>`;
    let s = pop(t, a + 0.25, 400, 490, book, 0.5);
    [[500, 160], [550, 130], [600, 150]].forEach(([y, w], k) => { s += drawOn(t, a + 0.7 + k * 0.18, 0.2, [[340, y], [340 + w, y]], { w: 7, seed: 20 + k, amp: 1.2, pen: false }); });
    s += tape(t, a + 0.6, 400, 300, 170, 44, -5, C.hl);
    const term = `${d.term} =`, ts = fit(term, 96, 720);
    s += writeOn(t, a + 0.5, 0.6, 640, 350, tw(term, ts), ts, text(640, 440, term, ts, C.ink));
    const pre = d.prefix || '', ps = 90, pw = pre ? tw(pre, ps) + 30 : 0;
    const ds = fit(d.def, 110, 760 - pw), dw = tw(d.def, ds), dx = 640 + pw;
    if (pre) s += rise(t, tk - 0.35, text(640, 600, pre, ps, C.sub));
    s += marker(t, tk, 0.4, dx - 5, 545, dw + 10, 58, { seed: 11 });
    s += rise(t, tk - 0.1, text(dx, 600, d.def, ds, C.ink));
    s += drawArrow(t, tk + 0.45, 0.5, 560, 640, dx - 20, 640, { bend: 60, w: 7, seed: 13 });
    return s;
  },
  // 清单：标题手写 + 2~3 张卡片依次弹出（贴胶带、荧光标签、卡片之间画箭头）
  list(t, i, d) {
    const [a] = spanOf(i), items = (d.items || []).slice(0, 3), n = items.length;
    const ttl = d.title || '', tts = fit(ttl, 64, 1200), ttw = tw(ttl, tts);
    addSfx(a + 0.05, 'scribble', 0.7);
    let s = writeOn(t, a + 0.05, 0.7, CX - ttw / 2, 190, ttw, tts, text(CX, 250, ttl, tts, C.ink, 'bold', 'middle'));
    const gap = n === 3 ? 450 : 520;
    items.forEach((it, k) => {
      const tk = kwTime(i, it.label); addSfx(tk, 'pop');
      const x = CX + (k - (n - 1) / 2) * gap, y = 520;
      const icon = (ICONS[it.icon] || ICONS.idea)(x, y - 50);
      const card = `<rect x="${x - 190}" y="${y - 190}" width="380" height="390" rx="28" fill="${C.card}" stroke="${C.ink}" stroke-width="6"/>
        <circle cx="${x - 150}" cy="${y - 150}" r="26" fill="${C.ink}"/>${text(x - 150, y - 139, String(k + 1), 32, '#fff', 'bold', 'middle')}${icon}`;
      s += pop(t, tk, x, y, card, 0.45);
      if (it.icon === 'check') s += drawOn(t, tk + 0.35, 0.35, [[x - 34, y - 50], [x - 8, y - 24], [x + 38, y - 80]], { w: 14, color: '#fff', seed: 31, amp: 0.8 });
      s += tape(t, tk + 0.3, x, y - 190, 140, 40, [-6, 4, -3][k], [C.hl, C.accent, C.hl][k]);
      const ls = fit(it.label, 58, 330), lw = tw(it.label, ls);
      s += marker(t, tk + 0.35, 0.35, x - lw / 2 - 6, y + 82, lw + 12, 46, { seed: 40 + k, opacity: 0.75 });
      s += rise(t, tk + 0.1, text(x, y + 120, it.label, ls, C.ink, 'bold', 'middle'), 16, 0.3);
      if (k > 0) { s += drawArrow(t, tk - 0.05, 0.4, x - gap + 120, y - 230, x - 120, y - 230, { bend: -45, w: 6, seed: 50 + k }); addSfx(tk - 0.05, 'scribble', 0.4); }
    });
    return s;
  },
  // 对比：左卡（画叉）→ 箭头 → 右卡（画勾）→ 结论便利贴落下
  compare(t, i, d) {
    const [a] = spanOf(i), tk = kwTime(i, d.key || (d.right && d.right.note));
    const L = d.left || {}, R = d.right || {};
    addSfx(a + 0.2, 'pop'); addSfx(a + 0.6, 'scribble', 0.35); addSfx(tk - 0.3, 'scribble', 0.5); addSfx(tk, 'pop'); addSfx(tk + 0.6, 'ding');
    const left = `<rect x="150" y="300" width="520" height="420" rx="30" fill="#ECE6DC" stroke="${C.ink}" stroke-width="6"/>
      ${text(410, 400, L.title || '', fit(L.title || '', 60, 460), C.sub, 'bold', 'middle')}<circle cx="410" cy="510" r="46" fill="${C.red}" stroke="${C.ink}" stroke-width="6"/>
      ${text(410, 650, L.note || '', fit(L.note || '', 52, 460), C.sub, 'bold', 'middle')}`;
    let s = pop(t, a + 0.2, 410, 510, left, 0.45);
    s += drawOn(t, a + 0.6, 0.15, [[392, 492], [428, 528]], { w: 12, color: '#fff', seed: 61, amp: 0.6, pen: false });
    s += drawOn(t, a + 0.78, 0.15, [[428, 492], [392, 528]], { w: 12, color: '#fff', seed: 62, amp: 0.6 });
    s += drawArrow(t, tk - 0.3, 0.45, 690, 510, 830, 510, { bend: -30, w: 9, seed: 63 });
    const right = `<rect x="850" y="280" width="560" height="460" rx="30" fill="${C.card}" stroke="${C.ink}" stroke-width="7"/>
      <rect x="850" y="280" width="560" height="110" rx="30" fill="${C.accent}" stroke="${C.ink}" stroke-width="7"/>
      ${text(1130, 355, R.title || '', fit(R.title || '', 64, 500), C.ink, 'bold', 'middle')}<circle cx="1130" cy="490" r="46" fill="${C.green}" stroke="${C.ink}" stroke-width="6"/>`;
    s += pop(t, tk, 1130, 510, right, 0.5);
    s += drawOn(t, tk + 0.35, 0.3, [[1108, 490], [1125, 507], [1154, 472]], { w: 12, color: '#fff', seed: 64, amp: 0.6 });
    s += sticky(t, tk + 0.6, 1130, 640, 420, 110, text(0, 20, R.note || '', fit(R.note || '', 58, 380), C.ink, 'bold', 'middle'));
    return s;
  },
};

// ---------- 固定界面 ----------
const BG = `<defs>${DEFS}<pattern id="d" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="3" fill="${C.dot}"/></pattern></defs>
<rect width="${W}" height="${H}" fill="${C.bg}"/><rect width="${W}" height="${H}" fill="url(#d)"/>`;

function chrome(t, idx) {
  const p = t / tl.duration;
  let s = `<rect x="80" y="34" width="${W - 160}" height="10" rx="5" fill="#E2D8C8"/><rect x="80" y="34" width="${(W - 160) * p}" height="10" rx="5" fill="${C.accent}"/>`;
  s += `<rect x="80" y="70" width="${tw(CHANNEL, 30) + 48}" height="52" rx="26" fill="${C.ink}"/>${text(104, 107, CHANNEL, 30, '#fff')}`;
  const lab = script.lines[idx].chapter;
  if (lab) {
    const x0 = 80 + tw(CHANNEL, 30) + 64;
    s += rise(t, sceneStart(idx), `<rect x="${x0}" y="70" width="52" height="52" rx="12" fill="${C.hl}" stroke="${C.ink}" stroke-width="4"/>${text(x0 + 26, 107, lab[0], 30, C.ink, 'bold', 'middle')}${text(x0 + 68, 107, lab[1], 32, C.ink)}`, 12, 0.3);
  }
  return s;
}

function subtitle(t) {
  const i = tl.spans.findIndex(([a, b]) => t >= a - 0.1 && t <= b + 0.15);
  if (i < 0) return '';
  const ln = script.lines[i];
  let segs = [{ s: ln.text, h: false }];
  for (const kw of ln.hl || []) segs = segs.flatMap(g => g.h ? [g] : g.s.split(kw).flatMap((x, j, arr) => j < arr.length - 1 ? [{ s: x, h: false }, { s: kw, h: true }] : [{ s: x, h: false }]));
  segs = segs.filter(g => g.s);
  const size = fit(ln.text, 50, 1400);
  const w = segs.reduce((a, g) => a + tw(g.s, size), 0) + 70;
  const x0 = Math.max(40, (W - 360 - w) / 2 + 40), y = 990;
  const o = clamp((t - tl.spans[i][0] + 0.1) / 0.12);
  const spans = segs.map(g => `<tspan fill="${g.h ? C.hl : '#fff'}">${esc(g.s)}</tspan>`).join('');
  return `<g opacity="${o}"><rect x="${x0}" y="${y - 52}" width="${w}" height="76" rx="18" fill="#1F1F24" opacity=".9"/>
    <text x="${x0 + 35}" y="${y + 2}" font-family="${FONT}" font-size="${size}" font-weight="bold">${spans}</text></g>`;
}

// ---------- 形象 ----------
const avatarInner = opts => renderAvatar({ ...opts, bubble: false }).replace(/<svg[^>]*>/, '').replace('</svg>', '');
function avatar(t, frame, idx) {
  const ln = script.lines[idx];
  const ms = MOUTHS[frame] || 'closed';
  const mouth = ms === 'closed' ? (ln.expr === 'surprised' ? 'o' : undefined) : ms;
  const blink = (t % 3.1) > 2.95 && ['normal', 'thinking', 'question'].includes(ln.expr || 'normal');
  const kick = Math.max(0, 1 - (t - spanOf(idx)[0]) / 0.3);
  const bob = Math.sin(t * 2 * Math.PI / 3.2) * 4 - kick * 14;
  return `<g transform="translate(1430 ${560 + bob}) scale(2)" stroke-linejoin="round" stroke-linecap="round">${avatarInner({ expr: ln.expr || 'normal', mouth, blink })}</g>`;
}

// ---------- 合成 ----------
function frameSvg(frame) {
  const t = frame / FPS;
  let idx = 0; script.lines.forEach((_, i) => { if (t >= sceneStart(i)) idx = i; });
  const scene = i => { const ln = script.lines[i]; const f = SCENES[ln.scene]; if (!f) throw new Error(`第 ${i + 1} 句的 scene "${ln.scene}" 不存在，可选：${Object.keys(SCENES).join(' / ')}`); return f(t, i, ln.data || {}); };
  // 镜头接力：上一场景向左移出，新场景从右侧滑入
  const raw = idx === 0 ? 1 : clamp((t - sceneStart(idx)) / 0.5);
  const e = easeInOut(raw), D = 1500;
  let body = '';
  if (idx > 0 && raw < 1) body += `<g transform="translate(${(-D * e).toFixed(1)} 0)">${scene(idx - 1)}</g>`;
  body += `<g transform="translate(${(D * (1 - e)).toFixed(1)} 0)">${scene(idx)}</g>`;
  if (idx > 0 && Math.abs(t - sceneStart(idx)) < 0.5 / FPS) addSfx(sceneStart(idx), 'whoosh');
  const end = clamp((tl.duration - t) / 0.4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${BG}${chrome(t, idx)}${body}${avatar(t, frame, idx)}${subtitle(t)}<rect width="${W}" height="${H}" fill="#000" opacity="${1 - end}"/></svg>`;
}
const png = svg => new Resvg(svg, { font: fontOpts }).render().asPng();

async function main() {
  if (script.lines.length !== tl.spans.length) throw new Error(`script.json 有 ${script.lines.length} 句，但配音切出 ${tl.spans.length} 句，请重新运行 voice.py`);
  for (let f = 0; f < N; f++) frameSvg(f);           // 先跑一遍收集音效时间点
  sfx.sort((a, b) => a.t - b.t);
  fs.writeFileSync(path.join(B, 'sfx.json'), JSON.stringify(sfx));
  console.log(`font: ${FONT}`);
  if (ONLY) {
    for (const sec of ONLY) fs.writeFileSync(path.join(B, `still_${sec}.png`), png(frameSvg(Math.round(sec * FPS))));
    console.log('stills done'); return;
  }
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', path.join(B, 'video_noaudio.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < N; f++) {
    if (!ff.stdin.write(png(frameSvg(f)))) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 60 === 0) process.stdout.write(`\r${f}/${N}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log(`\nframes ${N}, sfx ${sfx.length}`);
}
main();
