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
