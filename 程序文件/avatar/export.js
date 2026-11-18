// 导出全部表情 × 嘴型（闭/张）+ 眨眼，为 SVG 和透明底 PNG
// 用法：node export.js
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const { renderAvatar, EXPR } = require('./avatar.js');

const out = path.join(__dirname, 'output');
fs.mkdirSync(path.join(out, 'svg'), { recursive: true });
fs.mkdirSync(path.join(out, 'png'), { recursive: true });

const NAMES = { normal: '正常', question: '疑问', surprised: '惊讶', happy: '开心', thinking: '思考' };
const jobs = [];
for (const expr of Object.keys(EXPR)) {
  jobs.push([`${NAMES[expr]}_默认`, { expr }]);
  jobs.push([`${NAMES[expr]}_张嘴`, { expr, mouth: 'open' }]);
  jobs.push([`${NAMES[expr]}_闭嘴`, { expr, mouth: 'closed' }]);
}
jobs.push(['眨眼_闭嘴', { expr: 'normal', blink: true }]);
jobs.push(['眨眼_张嘴', { expr: 'normal', blink: true, mouth: 'open' }]);
jobs.push(['正常_无气泡', { expr: 'normal', bubble: false }]);

for (const [name, opts] of jobs) {
  const svg = renderAvatar(opts);
  fs.writeFileSync(path.join(out, 'svg', name + '.svg'), svg);
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 960 }, font: { loadSystemFonts: true } }).render().asPng();
  fs.writeFileSync(path.join(out, 'png', name + '.png'), png);
}

// 预览总览图（米色点阵底）
const cols = 5, cell = 240, rows = Math.ceil(jobs.length / cols);
let sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell}" height="${rows * (cell * 260 / 240 + 30)}" viewBox="0 0 ${cols * cell} ${rows * (cell * 260 / 240 + 30)}"><rect width="100%" height="100%" fill="#F4EEE3"/>`;
jobs.forEach(([name, opts], i) => {
  const x = (i % cols) * cell, y = Math.floor(i / cols) * (cell * 260 / 240 + 30);
  const inner = renderAvatar(opts).replace(/<svg[^>]*>/, '').replace('</svg>', '');
  sheet += `<g transform="translate(${x} ${y})"><g stroke-linejoin="round" stroke-linecap="round">${inner}</g><text x="${cell / 2}" y="${cell * 260 / 240 + 20}" text-anchor="middle" font-size="16" font-family="Microsoft YaHei, sans-serif" fill="#4A4038">${name}</text></g>`;
});
sheet += '</svg>';
fs.writeFileSync(path.join(out, '总览.svg'), sheet);
fs.writeFileSync(path.join(out, '总览.png'), new Resvg(sheet, { font: { loadSystemFonts: true } }).render().asPng());
console.log(`导出 ${jobs.length} 组 → ${out}`);
