// Hàm chung của các test mỏng doi-chung-*.test.mjs: chạy `node kiem/doi-chung.mjs <tên cấy…>` (gốc nhanh theo cỡ của cấy), phải rc 0 và «ĐỐI CHỨNG ĐẠT».
// Sáu tệp chạy song song mà mỗi con mở trình duyệt thật ⇒ quá tải làm chay-do quá hạn 240 s (đo 13/11: r6/k1 chập chờn) ⇒ xếp hàng bằng khoá tệp (pid)
// (hạn của bộ đo KHÔNG đổi). Khoá của tiến trình đã chết bị gỡ. Trong runner đột biến chỉ một tệp chạy ⇒ không phải đợi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as nghi } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
const DOI_CHUNG = fileURLToPath(new URL('../kiem/doi-chung.mjs', import.meta.url)), GOC = fileURLToPath(new URL('..', import.meta.url));
const KHOA = path.join(os.tmpdir(), 'web-os-doi-chung.khoa');   // tệp khoá chứa pid chủ; chủ đã chết (kể cả bị runner giết) ⇒ gỡ

// Khoá ra đời CÓ SẴN pid (ghi tệp riêng rồi link nguyên tử) ⇒ đọc ra không phải số dương = khoá hỏng/mồ côi, gỡ.
const goKhoa = () => { try { fs.unlinkSync(KHOA); } catch (e) { if (e.code !== 'ENOENT') throw e; } };
async function vaoHang() {
  const rieng = KHOA + '.' + process.pid;
  fs.writeFileSync(rieng, String(process.pid));
  try {
    for (;;) {
      try { fs.linkSync(rieng, KHOA); return; } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        let chu; try { chu = Number(fs.readFileSync(KHOA, 'utf8')); } catch (r) { if (r.code === 'ENOENT') continue; throw r; }
        let song = Number.isInteger(chu) && chu > 0;
        if (song) try { process.kill(chu, 0); } catch (k) { song = k.code === 'EPERM'; }
        if (!song) { goKhoa(); continue; }
        await nghi(2000);
      }
    }
  } finally { fs.unlinkSync(rieng); }
}

export function doiChung(ten, cay) {
  test(`đối chứng bộ đo: ${ten}`, { timeout: 3600000 }, async () => {
    await vaoHang();
    try {
      const r = spawnSync(process.execPath, [DOI_CHUNG, ...cay], { cwd: GOC, encoding: 'utf8', timeout: 400000 });
      const ra = (r.stdout || '') + (r.stderr || '');
      assert.equal(r.status, 0, ra.slice(0, 2000));
      assert.ok(ra.includes('ĐỐI CHỨNG ĐẠT'), ra.slice(0, 2000));
    } finally { let chu = null; try { chu = fs.readFileSync(KHOA, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; } if (chu === String(process.pid)) goKhoa(); }
  });
}
