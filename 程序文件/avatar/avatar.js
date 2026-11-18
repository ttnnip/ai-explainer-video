// 示例虚拟形象：小机器人“小方”（中性示例，请换成你自己的形象）
// 结构：身体 → 头（耳朵、天线、头壳、脸屏）→ 眼睛/眉毛/嘴（表情系统）
// renderAvatar({ expr, mouth, blink, nodY, bg }) -> SVG 字符串
// expr: normal | question | surprised | happy | thinking
// mouth: closed | open | o | smile | side （不传则用表情默认嘴型）

const ink = '#1D1515', skin = '#E6EFF7', EX = [92, 148], EY = 134;
const ACCENT = '#8FB8DE'; // 主题色（耳朵、身体）
const SHELL = '#F8FAFC', LINE = '#2B2B31';

const eyeD = (x, dx, dy) => `<ellipse cx="${x + dx}" cy="${EY + dy + 1}" rx="7.5" ry="8" fill="${ink}"/><circle cx="${x + dx + 2.5}" cy="${EY + dy - 1}" r="2.3" fill="#fff"/><rect x="${x - 12}" y="${EY - 14}" width="24" height="11" fill="${skin}"/><path d="M${x - 10} ${EY - 3} L${x + 10} ${EY - 4}" stroke="${ink}" stroke-width="3.5"/>`;
const eyeO = x => `<circle cx="${x}" cy="${EY}" r="10" fill="#fff" stroke="${ink}" stroke-width="3"/><circle cx="${x}" cy="${EY + 1}" r="4.5" fill="${ink}"/><circle cx="${x + 2}" cy="${EY - 1}" r="1.5" fill="#fff"/>`;
const eyeH = x => `<path d="M${x - 9} ${EY + 3} Q${x} ${EY - 8} ${x + 9} ${EY + 3}" fill="none" stroke="${ink}" stroke-width="4"/>`;
const eyeB = x => `<path d="M${x - 9} ${EY + 1} Q${x} ${EY + 4} ${x + 9} ${EY + 1}" fill="none" stroke="${ink}" stroke-width="3.5"/>`;
const brow = (x, y, t) => `<path d="M${x - 8} ${y + t} Q${x} ${y - 3} ${x + 8} ${y - t}" fill="none" stroke="#241A18" stroke-width="4.5"/>`;

const MOUTH = {
  closed: '<path d="M113 160 Q120 166 127 160" fill="none" stroke="#9E554D" stroke-width="2.6"/>',
  open: '<path d="M112 158 Q120 161 128 158 Q126 170 120 170 Q114 170 112 158Z" fill="#8E3F3B" stroke="#5E2724" stroke-width="1.6"/><path d="M115.5 166 Q120 163.5 124.5 166 Q122.5 169 120 169 Q117.5 169 115.5 166Z" fill="#E08A82"/>',
  half: '<path d="M113 159 Q120 161 127 159 Q125.5 165.5 120 165.5 Q114.5 165.5 113 159Z" fill="#8E3F3B" stroke="#5E2724" stroke-width="1.6"/>',
  o: '<ellipse cx="120" cy="163" rx="4.5" ry="6" fill="#8E3F3B" stroke="#5E2724" stroke-width="1.6"/>',
  smile: '<path d="M110 157 Q120 161 130 157 Q128 172 120 172 Q112 172 110 157Z" fill="#8E3F3B" stroke="#5E2724" stroke-width="1.6"/><path d="M114.5 167 Q120 164 125.5 167 Q123 171 120 171 Q117 171 114.5 167Z" fill="#E08A82"/>',
  side: '<path d="M114 162 Q121 159 127 163" fill="none" stroke="#9E554D" stroke-width="2.6"/>',
};

const EXPR = {
  normal: { b: [117, 117, 0], m: 'closed', r: 0, bub: '' },
  question: { b: [112, 119, 0], m: 'side', r: -7, bub: '?' },
  surprised: { b: [111, 111, 0], m: 'o', r: 0, bub: '!' },
  happy: { b: [115, 115, 0], m: 'smile', r: 3, bub: '' },
  thinking: { b: [118, 113, 2], m: 'side', r: 5, bub: '…' },
};

// 线条眼：正常/疑问/思考时用的眼睛画法
const line = (d, w = 4.2) => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${w}"/>`;
const EYE_STYLES = {
  dot: (x, dx, dy) => eyeD(x, dx, dy),                                                            // 原 D 淡定眼
  arc: (x, dx, dy) => line(`M${x + dx - 9} ${EY + dy + 3} Q${x + dx} ${EY + dy - 5} ${x + dx + 9} ${EY + dy + 3}`), // 弯月线
  flat: (x, dx, dy) => line(`M${x + dx - 8} ${EY + dy + 3} Q${x + dx} ${EY + dy + 0.5} ${x + dx + 8} ${EY + dy + 3}`, 4.8), // 平线（定稿）
  bean: (x, dx, dy) => line(`M${x + dx} ${EY + dy - 5} L${x + dx} ${EY + dy + 5}`, 5.5),            // 竖线豆豆
  down: (x, dx, dy) => line(`M${x + dx - 9} ${EY + dy - 1} Q${x + dx} ${EY + dy + 6} ${x + dx + 9} ${EY + dy - 1}`), // 下弯线
};
const BLINK = {
  dot: x => eyeB(x),
  arc: x => line(`M${x - 9} ${EY + 1} L${x + 9} ${EY + 1}`, 3.6),
  flat: x => line(`M${x - 9} ${EY + 4} Q${x} ${EY + 6} ${x + 9} ${EY + 4}`, 3.2),
  bean: x => line(`M${x - 6} ${EY} L${x + 6} ${EY}`, 4.5),
  down: x => line(`M${x - 9} ${EY + 1} L${x + 9} ${EY + 1}`, 3.6),
};

// 使用偏好：多用 开心 / 惊讶 / 眨眼。默认表情仍为“正常”。
const DEFAULT_EXPR = 'normal';
const PREFERRED_EXPRS = ['happy', 'surprised', 'blink'];
let EYE_STYLE = 'flat';
// 平线眼时眉毛更短、更靠上，避免和眼睛叠成“=”号
const BROW_LIFT = { flat: 3 };

function renderAvatar({ expr = DEFAULT_EXPR, mouth, blink = false, nodY = 0, bg = null, bubble = true, eyeStyle = EYE_STYLE } = {}) {
  const s = EXPR[expr];
  let eyes;
  if (blink && ['normal', 'question', 'thinking'].includes(expr)) eyes = BLINK[eyeStyle](EX[0]) + BLINK[eyeStyle](EX[1]);
  else if (expr === 'surprised') eyes = eyeO(EX[0]) + eyeO(EX[1]);
  else if (expr === 'happy') eyes = eyeH(EX[0]) + eyeH(EX[1]);
  else { const d = expr === 'thinking' ? [2.5, -2.5] : [0, 0]; const f = EYE_STYLES[eyeStyle]; eyes = f(EX[0], ...d) + f(EX[1], ...d); }
  const m = MOUTH[mouth || s.m];
  const rot = nodY ? `translate(0 ${nodY}) rotate(4 120 170)` : `rotate(${s.r} 120 170)`;
  return `<svg viewBox="0 0 240 260" width="960" height="1040" xmlns="http://www.w3.org/2000/svg" stroke-linejoin="round" stroke-linecap="round">
${bg ? `<rect width="240" height="260" fill="${bg}"/>` : ''}
<rect x="104" y="186" width="32" height="18" rx="4" fill="#C9D3DC" stroke="${LINE}" stroke-width="2.5"/>
<rect x="66" y="198" width="108" height="60" rx="20" fill="${ACCENT}" stroke="${LINE}" stroke-width="3"/>
<rect x="94" y="214" width="52" height="26" rx="8" fill="${SHELL}" stroke="${LINE}" stroke-width="2.5"/>
<circle cx="108" cy="227" r="5" fill="#FFD25E"/><circle cx="120" cy="227" r="5" fill="#4FA77A"/><circle cx="132" cy="227" r="5" fill="#E0665A"/>
<g transform="${rot}">
<line x1="120" y1="56" x2="120" y2="30" stroke="${LINE}" stroke-width="4"/>
<circle cx="120" cy="25" r="9" fill="#FFD25E" stroke="${LINE}" stroke-width="3"/>
<rect x="30" y="104" width="24" height="52" rx="10" fill="${ACCENT}" stroke="${LINE}" stroke-width="3"/>
<rect x="186" y="104" width="24" height="52" rx="10" fill="${ACCENT}" stroke="${LINE}" stroke-width="3"/>
<rect x="46" y="52" width="148" height="146" rx="44" fill="${SHELL}" stroke="${LINE}" stroke-width="3"/>
<path d="M70 70 Q120 56 170 70" fill="none" stroke="#D5DEE7" stroke-width="5"/>
<rect x="60" y="96" width="120" height="90" rx="30" fill="${skin}" stroke="${LINE}" stroke-width="2.5"/>
${eyes}
${(() => { const L = ['normal', 'question', 'thinking'].includes(expr) ? (BROW_LIFT[eyeStyle] || 0) : 0; const bw = (x, y, t) => L ? `<path d="M${x - 6.5} ${y + t} Q${x} ${y - 3} ${x + 6.5} ${y - t}" fill="none" stroke="#241A18" stroke-width="5"/>` : brow(x, y, t); return bw(EX[0], s.b[0] - L, s.b[2]) + bw(EX[1], s.b[1] - L, 0); })()}
${m}
</g>
${bubble && s.bub ? `<g><rect x="178" y="8" width="50" height="34" rx="12" fill="#fff" stroke="#2E2E34" stroke-width="2"/><path d="M188 41 L183 52 L198 42" fill="#fff" stroke="#2E2E34" stroke-width="2"/><text x="203" y="32" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#2E2E34">${s.bub}</text></g>` : ''}
</svg>`;
}

// 口型：把每帧音量变成 closed / half / open
// 1) 包络平滑（张得快、合得慢） 2) 迟滞阈值防抖 3) 每个口型至少保持 minHold 秒（限制最高开合频率）
// spans：说话区间 [[起,止],...]，区间外一律闭嘴
function lipSync(levels, fps, spans, { minHold = 0.16, openAt = 0.3, halfAt = 0.14, attack = 0.65, release = 0.3 } = {}) {
  const out = new Array(levels.length).fill('closed');
  const hold = Math.max(1, Math.round(minHold * fps));
  let env = 0, state = 'closed', held = hold;
  const rank = { closed: 0, half: 1, open: 2 };
  for (let f = 0; f < levels.length; f++) {
    const t = f / fps;
    const speaking = spans.some(([a, b]) => t >= a && t <= b);
    const lv = speaking ? levels[f] : 0;
    env += (lv - env) * (lv > env ? attack : release);
    // 迟滞：已张开时阈值放低一点，避免在阈值附近来回跳
    const k = rank[state] > 0 ? 0.8 : 1;
    let want = env > openAt * k ? 'open' : env > halfAt * k ? 'half' : 'closed';
    if (!speaking) want = 'closed';
    // 开→闭中间经过半张，动作更柔和
    if (want === 'closed' && state === 'open') want = 'half';
    if (want !== state && (held >= hold || !speaking)) { state = want; held = 0; }
    held++;
    out[f] = state;
  }
  return out;
}

if (typeof module !== 'undefined') module.exports = { lipSync, renderAvatar, EXPR, MOUTH, DEFAULT_EXPR, PREFERRED_EXPRS, EYE_STYLES };
