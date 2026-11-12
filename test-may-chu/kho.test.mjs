// Test khung kho (task A1): moKho (DDL, WAL, busy_timeout, luoc_do) + trongGiaoDich (khung Hub).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { moKho, trongGiaoDich } from '../may-chu/kho.mjs';

test('moKho tệp: WAL, busy_timeout 5000, luoc_do một dòng phiên 1 kể cả khi mở lại', () => {
  const tm = fs.mkdtempSync(path.join(os.tmpdir(), 'webos-kho-'));
  try {
    const f = path.join(tm, 'kho.db');
    let db = moKho(f);
    assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
    assert.equal(Object.values(db.prepare('PRAGMA busy_timeout').get())[0], 5000);
    db.close();
    db = moKho(f);
    assert.deepEqual(db.prepare('SELECT phien FROM luoc_do').all().map(r => r.phien), [1]);
    db.close();
  } finally { fs.rmSync(tm, { recursive: true, force: true }); }
});

test('moKho bộ nhớ: đủ bảng, chỉ mục viec_nguon_gieo, hai trigger nhat_ky', () => {
  const db = moKho();
  const ten = db.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
  assert.deepEqual(ten, ['cai_tien', 'de_xuat', 'goi_ghi', 'lich', 'luoc_do', 'nhat_ky', 'nhat_ky_khong_sua', 'nhat_ky_khong_xoa',
    'tien_do', 'viec', 'viec_nguon_gieo', 'y_tuong']);
  assert.equal(Object.values(db.prepare('PRAGMA busy_timeout').get())[0], 5000);
  assert.deepEqual(db.prepare('SELECT phien FROM luoc_do').all().map(r => r.phien), [1]);
});

test('trongGiaoDich: COMMIT khi xong; lỗi ⇒ ROLLBACK, ném lại đúng lỗi gốc, không còn giao dịch treo', () => {
  const db = moKho();
  assert.equal(trongGiaoDich(db, () => { db.exec('INSERT INTO luoc_do VALUES (2)'); return 7; }), 7);
  assert.throws(() => trongGiaoDich(db, () => { db.exec('INSERT INTO luoc_do VALUES (3)'); throw new Error('hỏng giữa chừng'); }), /hỏng giữa chừng/);
  assert.equal(db.isTransaction, false);
  assert.deepEqual(db.prepare('SELECT phien FROM luoc_do ORDER BY phien').all().map(r => r.phien), [1, 2]);
  assert.equal(trongGiaoDich(db, () => 'lại được'), 'lại được');
});
