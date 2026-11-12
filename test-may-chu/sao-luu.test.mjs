// Test sao lưu + diễn tập khôi phục + bộ hẹn (task A6, thiết kế v0.2 mục 5.6). Chuyển thể từ Family Hub main:hub/test/sao-luu.test.mjs.
// Đồng hồ giả cho bộ hẹn (không ngủ thật); mọi thư mục tạm dưới os.tmpdir() tiền tố wo-, dọn ở after.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { moKho } from '../may-chu/kho.mjs';
import { apGoi } from '../may-chu/goi.mjs';
import { khoiDong } from '../may-chu/may-chu.mjs';
import { saoLuu, diTapKhoiPhuc, dauVanTay, henSaoLuu } from '../may-chu/sao-luu.mjs';
import { moiTruong, layJwks } from './chung.mjs';

const MAY = fileURLToPath(new URL('../may-chu/may-chu.mjs', import.meta.url));
const BANG = ['cai_tien', 'de_xuat', 'goi_ghi', 'lich', 'luoc_do', 'nhat_ky', 'tien_do', 'viec', 'y_tuong'];   // mọi bảng trong DDL kho.mjs
const DON = [], KHO = [], mt = moiTruong();
after(async () => { for (const db of KHO) if (db.isOpen) db.close(); for (const d of DON) fs.rmSync(d, { recursive: true, force: true }); await mt.dong(); });
const tamMoi = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-sl-')); DON.push(d); return d; };

// Kho tệp (WAL như máy thật) có một việc (kèm nguon_gieo ⇒ chỉ mục viec_nguon_gieo có nội dung) + một lịch, ghi qua apGoi.
function khoTep() {
  const dir = tamMoi(), db = moKho(path.join(dir, 'kho.sqlite'));
  KHO.push(db);
  apGoi(db, { khoa_lap: 'sao-luu-0001', chu_the: 'anh', nguon: { loai: 'web' }, ops: [
    { loai: 'them', bang: 'viec', truong: { tieu_de: 'SAO-LUU-THU', han: '2026-11-20', nguon_gieo: 'ban-do:thu:1' } },
    { loai: 'them', bang: 'lich', truong: { tieu_de: 'Họp thử', bat_dau: '2026-11-12T09:00' } },
  ] }, '2026-11-12T01:00:00.000Z');
  return { dir, db };
}
const banSao = sl => (fs.existsSync(sl) ? fs.readdirSync(sl).filter(f => f.endsWith('.sqlite')).sort() : []);
const mode = f => fs.statSync(f).mode & 0o777;

// Đồng hồ giả: now() + setTimeout/clearTimeout; toi(t) bắn lần lượt mọi hẹn tới hạn ≤ t theo thứ tự thời gian.
function dongHoGia(t0) {
  let gio = t0, so = 0;
  const hen = new Map();
  return {
    now: () => gio,
    setTimeout: (fn, ms) => { hen.set(++so, { fn, luc: gio + ms }); return so; },
    clearTimeout: id => { hen.delete(id); },
    cho: () => [...hen.values()].map(h => h.luc).sort((a, b) => a - b),
    toi(dich) {
      for (let k; (k = [...hen].filter(([, h]) => h.luc <= dich).sort((a, b) => a[1].luc - b[1].luc || a[0] - b[0])[0]);) {
        hen.delete(k[0]); gio = k[1].luc; k[1].fn();
      }
      gio = dich;
    },
  };
}

test('sao lưu ⇒ diễn tập khôi phục ra cùng số dòng + băm TỪNG bảng (mọi bảng của kho); thư mục 0700, tệp + dấu 0600 dù umask 022', () => {
  const { dir, db } = khoTep(), sl = path.join(dir, 'sl', 'con'), cu = process.umask(0o022);
  let r;
  try { r = saoLuu(db, sl, new Date('2026-11-12T03:00:00Z'), 'gio'); } finally { process.umask(cu); }
  assert.equal(r.tep, path.join(sl, 'kho-gio-20261112-1000.sqlite'), 'tên theo giờ VN (UTC+7)');
  assert.equal(mode(sl), 0o700); assert.equal(mode(r.tep), 0o600); assert.equal(mode(r.tep + '.json'), 0o600);
  assert.deepEqual(Object.keys(r.dau.so_dong), BANG); assert.deepEqual(Object.keys(r.dau.bam), BANG);
  assert.deepEqual(r.dau.so_dong, { cai_tien: 0, de_xuat: 0, goi_ghi: 1, lich: 1, luoc_do: 1, nhat_ky: 2, tien_do: 0, viec: 1, y_tuong: 0 });
  assert.ok(Object.values(r.dau.bam).every(h => /^[0-9a-f]{64}$/.test(h)));
  assert.deepEqual(r.dau, dauVanTay(db), 'dấu ghi kèm = dấu bản sống');
  assert.deepEqual(JSON.parse(fs.readFileSync(r.tep + '.json', 'utf8')), r.dau);
  const tam = tamMoi(), d = diTapKhoiPhuc(r.tep, tam);
  assert.equal(d.khop, true); assert.deepEqual(d.ra, r.dau); assert.deepEqual(d.mong, r.dau);
  assert.deepEqual(fs.readdirSync(tam), [], 'diễn tập dọn bản chép');
  // Đối chứng: bản sao bị sửa MỘT byte nội dung ⇒ diễn tập báo lệch, đúng một bảng lệch băm, số dòng vẫn bằng.
  const b = fs.readFileSync(r.tep), vt = b.indexOf('SAO-LUU-THU');
  assert.ok(vt > 0, 'không thấy chuỗi trong bản sao — phép đo không chạy');
  b[vt] ^= 0x01; fs.writeFileSync(r.tep, b);
  const l = diTapKhoiPhuc(r.tep, tam);
  assert.equal(l.khop, false);
  assert.deepEqual(l.ra.so_dong, l.mong.so_dong);
  assert.equal(BANG.filter(t => l.ra.bam[t] !== l.mong.bam[t]).length, 1);
});

test('sao lưu loại sai ⇒ ném, không tạo gì', () => {
  const { dir, db } = khoTep(), sl = path.join(dir, 'sl');
  assert.throws(() => saoLuu(db, sl, new Date(), 'tuan'), /loai/);
  assert.ok(!fs.existsSync(sl));
});

// Proxy chạy VACUUM INTO thật rồi làm hỏng tệp .tam (bản sao lệch ngầm sau khi chép).
const hongSauVacuum = (db, hong) => new Proxy(db, { get(t, k) {
  if (k === 'prepare') return sql => /^VACUUM/.test(sql) ? { run: tam => { t.prepare(sql).run(tam); hong(tam); } } : t.prepare(sql);
  const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
} });

test('bản sao lệch bản sống (nội dung đổi sau VACUUM) ⇒ ném «lệch», không .tam, không bản mới, bản cũ nguyên', () => {
  const { dir, db } = khoTep(), sl = path.join(dir, 'sl');
  saoLuu(db, sl, new Date('2026-11-12T01:00:00Z'), 'gio');
  const truoc = fs.readdirSync(sl).sort();
  const x = hongSauVacuum(db, tam => { const b = new DatabaseSync(tam); b.prepare("UPDATE viec SET tieu_de = 'DA-SUA'").run(); b.close(); });
  assert.throws(() => saoLuu(x, sl, new Date('2026-11-12T02:00:00Z'), 'gio'), /lệch bản sống/);
  assert.deepEqual(fs.readdirSync(sl).sort(), truoc);
  // Đối chứng: không hỏng ⇒ có bản mới; tệp tạm cũ trùng tên (tiến trình chết giữa chừng) không chặn lần sao lưu sau.
  for (const t of ['.tam', '.json.tam']) fs.writeFileSync(path.join(sl, 'kho-gio-20261112-0900.sqlite' + t), 'CU');
  saoLuu(db, sl, new Date('2026-11-12T02:00:00Z'), 'gio');
  assert.deepEqual(fs.readdirSync(sl).sort(), ['kho-gio-20261112-0800.sqlite', 'kho-gio-20261112-0800.sqlite.json', 'kho-gio-20261112-0900.sqlite', 'kho-gio-20261112-0900.sqlite.json']);
});

test('bản sao hỏng chỉ mục nhưng bảng vẫn đọc được ⇒ integrity_check bắt, không bản mới', () => {
  const { dir, db } = khoTep(), sl = path.join(dir, 'sl');
  saoLuu(db, sl, new Date('2026-11-12T01:00:00Z'), 'gio');
  const truoc = fs.readdirSync(sl).sort();
  const x = hongSauVacuum(db, tam => {   // lật byte cuối trang gốc của chỉ mục viec_nguon_gieo (dấu vân tay đọc bảng, không qua chỉ mục này)
    const b = new DatabaseSync(tam), goc = b.prepare("SELECT rootpage FROM sqlite_master WHERE name = 'viec_nguon_gieo'").get().rootpage;
    const kt = Object.values(b.prepare('PRAGMA page_size').get())[0]; b.close();
    const f = fs.openSync(tam, 'r+'), vt = goc * kt - 1, o = Buffer.alloc(1);
    fs.readSync(f, o, 0, 1, vt); fs.writeSync(f, Buffer.from([o[0] ^ 0xff]), 0, 1, vt); fs.closeSync(f);
  });
  assert.throws(() => saoLuu(x, sl, new Date('2026-11-12T02:00:00Z'), 'gio'), /integrity_check/);
  assert.deepEqual(fs.readdirSync(sl).sort(), truoc);
});

test('giữ 48 bản giờ + 14 bản ngày; chỉ xoá tệp đúng mẫu tên của loại đó (kèm .json), chỉ trong thư mục sao lưu', () => {
  const { dir, db } = khoTep(), sl = path.join(dir, 'sl'), ngoai = path.join(dir, 'kho-gio-20200101-0000.sqlite');
  fs.mkdirSync(sl);
  const p2 = n => String(n).padStart(2, '0');
  const gia = ten => { fs.writeFileSync(path.join(sl, ten), ''); fs.writeFileSync(path.join(sl, ten + '.json'), ''); };
  for (let i = 0; i < 49; i++) gia(`kho-gio-202610${p2(1 + Math.floor(i / 24))}-${p2(i % 24)}00.sqlite`);
  for (let i = 1; i <= 14; i++) gia(`kho-ngay-202610${p2(i)}-0300.sqlite`);
  const LA = ['ghi-chu.txt', 'kho-gio-20200101-0000.sqlite.tam', 'cu-kho-gio-20200101-0000.sqlite', 'kho-gio-2020.sqlite', 'kho-tuan-20200101-0000.sqlite', 'kho-ngay-20200101-0300.sqlite.json.tam'];
  for (const f of LA) fs.writeFileSync(path.join(sl, f), 'GIU');
  fs.writeFileSync(ngoai, 'GIU');
  const loai = l => banSao(sl).filter(f => f.startsWith(`kho-${l}-2026`));
  saoLuu(db, sl, new Date('2026-11-12T03:00:00Z'), 'gio');
  assert.equal(loai('gio').length, 48); assert.equal(loai('gio')[0], 'kho-gio-20261001-0200.sqlite');
  assert.ok(!fs.existsSync(path.join(sl, 'kho-gio-20261001-0000.sqlite.json')), '.json của bản bị dọn cũng đi');
  assert.equal(loai('ngay').length, 14, 'bản giờ không dọn bản ngày');
  saoLuu(db, sl, new Date('2026-11-12T03:00:00Z'), 'ngay');
  assert.equal(loai('ngay').length, 14); assert.equal(loai('ngay')[0], 'kho-ngay-20261002-0300.sqlite');
  assert.equal(loai('gio').length, 48, 'bản ngày không dọn bản giờ');
  assert.equal(fs.readdirSync(sl).filter(f => f.endsWith('.sqlite.json')).length, 62);
  for (const f of LA) assert.equal(fs.readFileSync(path.join(sl, f), 'utf8'), 'GIU', f);
  assert.equal(fs.readFileSync(ngoai, 'utf8'), 'GIU');
});

test('bộ hẹn (đồng hồ giả): 01:30 VN qua 2 giờ ⇒ đúng 2 bản giờ (02:00, 03:00) + 1 bản ngày (03:00); hẹn lại theo giờ mới; dung() rồi qua giờ ⇒ không bản mới', () => {
  const { dir, db } = khoTep(), sl = path.join(dir, 'sl'), log = [];
  const t0 = Date.parse('2026-11-11T18:30:00Z'), dh = dongHoGia(t0);   // 01:30 giờ VN ngày 12/11
  const h = henSaoLuu(db, { thuMucSaoLuu: sl }, { dongHo: dh, ghiLog: s => log.push(s) });
  assert.deepEqual(dh.cho(), [Date.parse('2026-11-11T19:00:00Z'), Date.parse('2026-11-11T20:00:00Z')], 'hẹn 02:00 (giờ) và 03:00 (ngày) giờ VN');
  assert.deepEqual(banSao(sl), [], 'lúc hẹn chưa sao lưu');
  dh.toi(t0 + 2 * 3600e3);
  assert.deepEqual(banSao(sl), ['kho-gio-20261112-0200.sqlite', 'kho-gio-20261112-0300.sqlite', 'kho-ngay-20261112-0300.sqlite']);
  assert.deepEqual(dh.cho(), [Date.parse('2026-11-11T21:00:00Z'), Date.parse('2026-11-12T20:00:00Z')], 'hẹn lại: 04:00 (giờ), 03:00 hôm sau (ngày)');
  assert.equal(log.filter(s => /^sao lưu (gio|ngay) xong kho-/.test(s)).length, 3);
  h.dung();
  assert.deepEqual(dh.cho(), []);
  dh.toi(t0 + 30 * 3600e3);
  assert.equal(banSao(sl).length, 3);
});

test('bộ hẹn: sao lưu lỗi ⇒ ghi log LỖI, không ném ra ngoài bộ hẹn, vẫn hẹn lần kế', () => {
  const { dir, db } = khoTep(), sl = path.join(dir, 'la-tep'), log = [];
  fs.writeFileSync(sl, 'x');   // chỗ thư mục sao lưu là một tệp ⇒ mkdir lỗi
  const t0 = Date.parse('2026-11-11T18:30:00Z'), dh = dongHoGia(t0), h = henSaoLuu(db, { thuMucSaoLuu: sl }, { dongHo: dh, ghiLog: s => log.push(s) });
  dh.toi(t0 + 3600e3);
  assert.match(log.join('\n'), /LỖI sao lưu gio/);
  assert.deepEqual(dh.cho(), [Date.parse('2026-11-11T20:00:00Z'), Date.parse('2026-11-11T20:00:00Z')]);
  h.dung();
});

test('khởi động máy chủ ⇒ bộ hẹn chạy (bản giờ vào thuMucSaoLuu, diễn tập khớp); dong() ⇒ dung(), hết hẹn', async () => {
  const f = mt.cauHinh(), sl = JSON.parse(fs.readFileSync(f, 'utf8')).thuMucSaoLuu;
  const t0 = Date.parse('2026-11-11T18:30:00Z'), dh = dongHoGia(t0);
  const m = await khoiDong(f, { layJwks, ghiLog: () => {}, dongHo: dh });
  try {
    assert.equal(dh.cho().length, 2);
    dh.toi(t0 + 3600e3);
    assert.deepEqual(banSao(sl), ['kho-gio-20261112-0200.sqlite']);
    assert.equal(diTapKhoiPhuc(path.join(sl, 'kho-gio-20261112-0200.sqlite'), tamMoi()).khop, true);
  } finally { await m.dong(); }
  assert.deepEqual(dh.cho(), []);
});

test('CLI: SIGTERM / SIGINT ⇒ dong() (gỡ socket, đóng kho sạch: hết -wal), thoát 0', async () => {
  for (const tin of ['SIGTERM', 'SIGINT']) {
    const f = mt.cauHinh(), c = JSON.parse(fs.readFileSync(f, 'utf8')), wal = path.join(c.thuMucKho, 'kho.sqlite-wal');
    const con = spawn(process.execPath, [MAY, f], { stdio: ['ignore', 'ignore', 'pipe'] });
    try {
      await new Promise((ok, loi) => {
        let e = '';
        con.stderr.on('data', d => { e += d; if (e.includes('\n')) ok(); });
        con.on('exit', ma => loi(new Error(`thoát ${ma}: ${e}`)));
        setTimeout(() => loi(new Error('hết giờ')), 5000).unref();
      });
      assert.ok(fs.existsSync(wal) && fs.existsSync(c.ngheSocket), tin + ': đang chạy phải có -wal và socket (phép đo phân biệt được)');
      const thoat = once(con, 'exit');
      con.kill(tin);
      assert.deepEqual(await thoat, [0, null], tin);
      assert.ok(!fs.existsSync(c.ngheSocket), tin + ': socket chưa gỡ'); assert.ok(!fs.existsSync(wal), tin + ': kho chưa đóng');
    } finally { if (con.exitCode === null && con.signalCode === null) con.kill('SIGKILL'); }
  }
});
