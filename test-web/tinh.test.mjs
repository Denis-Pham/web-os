// Kiểm tĩnh bản giao diện web/ (không trình duyệt): luật bản A5 (phẳng, tên, đuôi, cỡ, số tệp, tổng — hằng nhập từ may-chu/ban.mjs),
// soát mã nguy hiểm (R4: bắt dạng DÙNG, không bắt chữ trần), Khuôn L8 (kiem/do-kich-thuoc.sh). Đối chứng: mẫu sai dựng trong test phải bị bắt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TRAN_TEP, TRAN_SO_TEP, TRAN_TONG, tenDung } from '../may-chu/ban.mjs';
import { WEB } from './chung-web.mjs';

const DO_KT = fileURLToPath(new URL('../kiem/do-kich-thuoc.sh', import.meta.url));
const TEN = fs.readdirSync(WEB).sort();

export function soatTinh(ten, chu) {
  const loi = [];
  if (ten.endsWith('.js')) {
    for (const m of [/\.innerHTML\s*=/, /\.outerHTML\s*=/, /insertAdjacentHTML\(/, /document\.write\(/, /\beval\(/, /new Function/, /setAttribute\(\s*['"]style/]) if (m.test(chu)) loi.push(m.source);
  }
  if (/\.(js|html)$/.test(ten) && /\sstyle\s*=/.test(chu)) loi.push('style=');
  if (ten.endsWith('.html')) {
    if (/<script(?![^>]*\ssrc\s*=)[^>]*>/i.test(chu)) loi.push('script nội tuyến');
    if (/\son[a-z]+\s*=/i.test(chu)) loi.push('on*=');
  }
  return loi;
}

test('luật bản A5: phẳng, tên đúng, mỗi tệp ≤ TRAN_TEP, số tệp ≤ TRAN_SO_TEP, tổng ≤ TRAN_TONG', () => {
  assert.ok(TEN.includes('index.html') && TEN.includes('khung.js'));
  let tong = 0;
  for (const t of TEN) {
    const st = fs.lstatSync(path.join(WEB, t));
    assert.ok(st.isFile(), 'không phải tệp thường: ' + t);
    assert.ok(tenDung(t), 'tên sai: ' + t);
    assert.ok(st.size <= TRAN_TEP, `${t} ${st.size} B`);
    tong += st.size;
  }
  assert.ok(TEN.length <= TRAN_SO_TEP && tong <= TRAN_TONG, `${TEN.length} tệp, ${tong} B`);
});

test('soatTinh: không tệp web/ nào dùng HTML thô, eval, style nội tuyến, script nội tuyến, on*=', () => {
  for (const t of TEN.filter(x => /\.(js|html)$/.test(x))) assert.deepEqual(soatTinh(t, fs.readFileSync(path.join(WEB, t), 'utf8')), [], t);
});

test('đối chứng soatTinh: mỗi mẫu sai bị bắt, mẫu đúng (chữ trần innerHTML trong so sánh) không', () => {
  const sai = [
    ['a.js', 'n.innerHTML = s;'], ['a.js', "n.insertAdjacentHTML('beforeend', s);"], ['a.js', 'document.write(s);'],
    ['a.js', "n.setAttribute('style', 'x');"], ['a.html', '<p style="x">a</p>'], ['a.html', '<script>alert(1)</script>'],
    ['a.html', '<img src="x" onerror="a()">'], ['a.js', 'eval(s);'], ['a.js', 'n.outerHTML = s;'],
  ];
  for (const [t, chu] of sai) assert.notDeepEqual(soatTinh(t, chu), [], chu);
  assert.deepEqual(soatTinh('a.js', "if (k === 'innerHTML') throw 1;"), []);
  assert.deepEqual(soatTinh('a.html', '<script type="module" src="khung.js"></script>'), []);
});

test('Khuôn L8: do-kich-thuoc.sh ĐẠT trên web/; đối chứng tệp 20 481 B ⇒ TRƯỢT rc 1', () => {
  let r = spawnSync('/bin/bash', [DO_KT], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /^KICH-THUOC: ĐẠT$/m);
  const tam = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-kt-')), f = path.join(tam, 'lon.js');
  try {
    fs.writeFileSync(f, 'x'.repeat(TRAN_TEP + 1));
    r = spawnSync('/bin/bash', [DO_KT, tam], { encoding: 'utf8' });
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /lon\.js 20481 B/);
    assert.match(r.stdout, /^KICH-THUOC: TRƯỢT$/m);
  } finally { fs.unlinkSync(f); fs.rmdirSync(tam); }
});

// sw.js: VO (vỏ đệm lúc cài) ⇔ tệp thật — mọi .html/.css/.js trừ sw.js, + '/', manifest, svg, lien-ket.json (không PNG, không ban.json).
export function lechVo(ten, sw) {
  const vo = [...(/const VO = \[([^\]]*)\]/.exec(sw)?.[1] ?? '').matchAll(/'([^']*)'/g)].map(x => x[1]);
  const mong = ['/', ...ten.filter(t => /\.(html|css|js)$/.test(t) && t !== 'sw.js').map(t => '/' + t), '/manifest.webmanifest', '/bieu-tuong.svg', '/lien-ket.json'];
  return { thieu: mong.filter(x => !vo.includes(x)).sort(), thua: vo.filter(x => !mong.includes(x)).sort() };
}
// PNG: chữ ký 8 byte + khối đầu IHDR ⇒ [rộng, cao]; sai ⇒ null.
const KY_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const coPng = b => (b.length >= 24 && b.subarray(0, 8).equals(KY_PNG) && b.toString('latin1', 12, 16) === 'IHDR' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null);

test('sw.js: VO ⇔ tệp thật của web/; đối chứng thiếu một tệp / thừa một đường ⇒ bắt', () => {
  assert.deepEqual(lechVo(TEN, fs.readFileSync(path.join(WEB, 'sw.js'), 'utf8')), { thieu: [], thua: [] });
  const gia = "const VO = ['/', '/a.js', '/manifest.webmanifest', '/bieu-tuong.svg', '/lien-ket.json', '/khong-co.js'];";
  assert.deepEqual(lechVo(['a.js', 'b.css', 'sw.js', 'x.png'], gia), { thieu: ['/b.css'], thua: ['/khong-co.js'] });
});

test('biểu tượng PNG 180/192/512: chữ ký + IHDR đúng cỡ; đối chứng sai cỡ / sai chữ ký ⇒ bắt', () => {
  for (const n of [180, 192, 512]) assert.deepEqual(coPng(fs.readFileSync(path.join(WEB, `bieu-tuong-${n}.png`))), [n, n], String(n));
  const b = Buffer.from(fs.readFileSync(path.join(WEB, 'bieu-tuong-192.png')));
  b.writeUInt32BE(191, 16);
  assert.deepEqual(coPng(b), [191, 192]);
  b[1] = 0;
  assert.equal(coPng(b), null);
});
