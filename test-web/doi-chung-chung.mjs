// Hàm chung của các test mỏng doi-chung-*.test.mjs: chạy `node kiem/doi-chung.mjs <tên cấy…>` (gốc nhanh theo cỡ của cấy), phải rc 0 và «ĐỐI CHỨNG ĐẠT».
// Sáu tệp chạy song song mà mỗi con mở trình duyệt thật ⇒ quá tải làm chay-do quá hạn 240 s (đo 13/11: r6/k1 chập chờn) ⇒ xếp hàng bằng khoá mkdir
// (hạn của bộ đo KHÔNG đổi). Khoá mồ côi > 15 phút bị gỡ. Trong runner đột biến chỉ một tệp chạy ⇒ không phải đợi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as nghi } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
const DOI_CHUNG = fileURLToPath(new URL('../kiem/doi-chung.mjs', import.meta.url)), GOC = fileURLToPath(new URL('..', import.meta.url));
const KHOA = path.join(os.tmpdir(), 'web-os-doi-chung.khoa');

async function vaoHang() {
  for (;;) {
    try { fs.mkdirSync(KHOA); return; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - fs.statSync(KHOA).mtimeMs > 15 * 60000) fs.rmdirSync(KHOA); } catch { /* khoá vừa được trả */ }
      await nghi(2000);
    }
  }
}

export function doiChung(ten, cay) {
  test(`đối chứng bộ đo: ${ten}`, { timeout: 3600000 }, async () => {
    await vaoHang();
    try {
      const r = spawnSync(process.execPath, [DOI_CHUNG, ...cay], { cwd: GOC, encoding: 'utf8', timeout: 470000 });
      const ra = (r.stdout || '') + (r.stderr || '');
      assert.equal(r.status, 0, ra.slice(0, 2000));
      assert.ok(ra.includes('ĐỐI CHỨNG ĐẠT'), ra.slice(0, 2000));
    } finally { fs.rmdirSync(KHOA); }
  });
}
