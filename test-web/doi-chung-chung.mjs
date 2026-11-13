// Hàm chung của các test mỏng doi-chung-*.test.mjs: chạy `node kiem/doi-chung.mjs <tên cấy…>` (gốc nhanh theo cỡ của cấy), phải rc 0 và «ĐỐI CHỨNG ĐẠT».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const DOI_CHUNG = fileURLToPath(new URL('../kiem/doi-chung.mjs', import.meta.url)), GOC = fileURLToPath(new URL('..', import.meta.url));

export function doiChung(ten, cay) {
  test(`đối chứng bộ đo: ${ten}`, { timeout: 480000 }, () => {
    const r = spawnSync(process.execPath, [DOI_CHUNG, ...cay], { cwd: GOC, encoding: 'utf8', timeout: 470000 });
    const ra = (r.stdout || '') + (r.stderr || '');
    assert.equal(r.status, 0, ra.slice(0, 2000));
    assert.ok(ra.includes('ĐỐI CHỨNG ĐẠT'), ra.slice(0, 2000));
  });
}
