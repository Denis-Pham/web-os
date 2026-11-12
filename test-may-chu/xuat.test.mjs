// Test tệp xuất (task A6, thiết kế v0.2 mục 4, 8, 16.1): đọc theo lược đồ ĐÓNG (trần cỡ, trường lạ/thiếu, symlink, cũ, thiếu tệp,
// giữ bản tốt cuối) và ghi so-dem.json chỉ số. Mỗi ca hỏng có đối chứng: cùng tệp đúng lược đồ ⇒ tot.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { moKho } from '../may-chu/kho.mjs';
import { apGoi } from '../may-chu/goi.mjs';
import { docTepXuat, ghiSoDem, LUOC_VIEC_BO, LUOC_TRANG_THAI, LUOC_SO_DEM } from '../may-chu/xuat.mjs';

const DON = [];
after(() => { for (const d of DON) fs.rmSync(d, { recursive: true, force: true }); });
const tamMoi = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-xuat-')); DON.push(d); return d; };
const mau = ten => JSON.parse(fs.readFileSync(new URL('./mau/' + ten, import.meta.url), 'utf8'));
const truoc = ms => new Date(Date.now() - ms).toISOString();
const moi = o => ({ ...structuredClone(o), gio_dung: truoc(0) });   // bản mẫu với gio_dung vừa dựng
const viet = (f, o) => fs.writeFileSync(f, typeof o === 'string' || Buffer.isBuffer(o) ? o : JSON.stringify(o));
const dem = (o, n) => { const s = JSON.stringify(o); return s + ' '.repeat(n - Buffer.byteLength(s)); };   // JSON hợp lệ đệm khoảng trắng tới đúng n byte
const tot = o => ({ trang_thai: 'tot', du_lieu: o, gio_dung: o.gio_dung });
const hong = o => ({ trang_thai: 'hong', du_lieu: o ?? null, gio_dung: o?.gio_dung ?? null });

test('bản mẫu viec-bo.json, trang-thai.json đúng lược đồ ⇒ tot, trả đúng dữ liệu + gio_dung', () => {
  const d = tamMoi();
  for (const [ten, luoc] of [['viec-bo.json', LUOC_VIEC_BO], ['trang-thai.json', LUOC_TRANG_THAI]]) {
    const f = path.join(d, ten), o = moi(mau(ten));
    viet(f, o);
    assert.deepEqual(docTepXuat(f, luoc), tot(o), ten);
  }
});

test('tệp > 2 MB ⇒ hong, giữ bản tốt cuối (du_lieu + gio_dung của nó); đúng 2 MB ⇒ tot; trần tranByte truyền vào được dùng', () => {
  const d = tamMoi(), f = path.join(d, 'viec-bo.json'), TRAN = 2 * 1024 * 1024;
  const a = moi(mau('viec-bo.json')), b = moi(mau('viec-bo.json')), c = moi(mau('viec-bo.json'));
  b.viec[0].ten = 'Bản quá cỡ'; c.viec[0].ten = 'Bản vừa trần';
  viet(f, a); assert.deepEqual(docTepXuat(f, LUOC_VIEC_BO), tot(a));
  viet(f, dem(b, TRAN + 1)); assert.deepEqual(docTepXuat(f, LUOC_VIEC_BO), hong(a), '2 MB + 1 byte');
  viet(f, dem(c, TRAN)); assert.deepEqual(docTepXuat(f, LUOC_VIEC_BO), tot(c), 'đúng 2 MB');
  viet(f, dem(b, 1001)); assert.deepEqual(docTepXuat(f, LUOC_VIEC_BO, { tranByte: 1000 }), hong(c), 'tranByte 1000, tệp 1001');
  viet(f, dem(b, 1000)); assert.deepEqual(docTepXuat(f, LUOC_VIEC_BO, { tranByte: 1000 }), tot(b), 'tranByte 1000, tệp 1000');
});

test('luoc_do sai / trường lạ / thiếu trường / sai kiểu / mảng > 200 / chuỗi > 500 / gio_dung không ISO / không phải JSON ⇒ hong, giữ bản tốt cuối', () => {
  const d = tamMoi(), TT = moi(mau('trang-thai.json')), VB = moi(mau('viec-bo.json'));
  const SD = { luoc_do: 1, gio_dung: truoc(0), viec_mo: 3, qua_han: 1, lich_hom_nay: 0, de_xuat_cho: 2 };
  const sua = (goc, f) => { const o = structuredClone(goc), r = f(o); return r === undefined ? o : r; };
  const CA = [
    [TT, LUOC_TRANG_THAI, [
      ['luoc_do 2', o => { o.luoc_do = 2; }], ['luoc_do "1"', o => { o.luoc_do = '1'; }], ['thiếu luoc_do', o => { delete o.luoc_do; }],
      ['trường lạ ở gốc', o => { o.la = 'x'; }], ['trường lạ trong phần tử', o => { o.xai_duoc[0].la = 'x'; }],
      ['__proto__ ở gốc', o => JSON.stringify(o).replace('{', '{"__proto__":{},')],
      ['thiếu trường ở gốc', o => { delete o.nhat_ky; }], ['thiếu trường trong phần tử', o => { delete o.cho_anh[0].ma; }],
      ['lá là số', o => { o.suc_khoe[0].trang_thai = 1; }], ['lá null', o => { o.suc_khoe[0].trang_thai = null; }],
      ['mảng thành object', o => { o.tien_do = {}; }], ['phần tử là chuỗi', o => { o.nhat_ky = ['x']; }],
      ['mảng 201 phần tử', o => { o.nhat_ky = Array(201).fill(o.nhat_ky[0]); }], ['chuỗi 501 ký tự', o => { o.xai_duoc[0].ten = 'ệ'.repeat(501); }],
      ['gio_dung chữ', o => { o.gio_dung = 'hôm qua'; }], ['gio_dung 30/02', o => { o.gio_dung = '2026-02-30T00:00:00Z'; }],
      ['gio_dung tháng 13', o => { o.gio_dung = '2026-13-01T00:00:00Z'; }], ['gio_dung 24:00', o => { o.gio_dung = '2026-11-12T24:00:00Z'; }],
      ['gio_dung thiếu múi giờ', o => { o.gio_dung = '2026-11-12T10:00:00'; }], ['gio_dung chỉ ngày', o => { o.gio_dung = '2026-11-12'; }],
      ['gio_dung có tiền tố', o => { o.gio_dung = 'x' + o.gio_dung; }], ['gio_dung có đuôi', o => { o.gio_dung += 'x'; }],
      ['gio_dung là số', o => { o.gio_dung = Date.now(); }],
      ['gốc là mảng', () => []], ['gốc là null', () => 'null'], ['không phải JSON', () => '{"luoc_do": 1,'], ['UTF-8 hỏng', o => Buffer.concat([Buffer.from(JSON.stringify(o)).subarray(0, 40), Buffer.from([0xff]), Buffer.from(JSON.stringify(o)).subarray(40)])],
    ]],
    [VB, LUOC_VIEC_BO, [
      ['xong là chuỗi', o => { o.viec[0].xong = 'false'; }], ['han là số', o => { o.viec[0].han = 20261115; }], ['lap là bool', o => { o.viec[1].lap = true; }],
      ['trường lạ trong việc', o => { o.viec[0].ghi_chu = 'x'; }], ['thiếu sua_luc', o => { delete o.viec[0].sua_luc; }], ['id null', o => { o.viec[0].id = null; }],
    ]],
    [SD, LUOC_SO_DEM, [
      ['số âm', o => { o.viec_mo = -1; }], ['số lẻ', o => { o.qua_han = 1.5; }], ['số là chuỗi', o => { o.de_xuat_cho = '2'; }], ['thiếu lich_hom_nay', o => { delete o.lich_hom_nay; }],
      ['trường lạ tieu_de', o => { o.tieu_de = 'x'; }],
    ]],
  ];
  for (const [goc, luoc, ds] of CA) {
    const f = path.join(d, 'tep.json');
    viet(f, goc); assert.deepEqual(docTepXuat(f, luoc), tot(goc), 'đối chứng: bản gốc');
    for (const [ten, doi] of ds) { viet(f, sua(goc, doi)); assert.deepEqual(docTepXuat(f, luoc), hong(goc), ten); }
    fs.rmSync(f);
  }
  // Đối chứng biên: đúng 200 phần tử, đúng 500 ký tự (nhiều byte; emoji = 1 ký tự dù 2 đơn vị UTF-16), chuỗi null nơi được phép, ISO +07:00 và 6 số lẻ ⇒ tot.
  const f = path.join(d, 'bien.json'), vn = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 23) + '456+07:00';
  for (const [luoc, o] of [
    [LUOC_TRANG_THAI, sua(TT, o => { o.nhat_ky = Array(200).fill(o.nhat_ky[0]); o.xai_duoc[0].ten = 'ệ'.repeat(500); o.cho_anh[0].tieu_de = '😀'.repeat(500); o.gio_dung = vn; })],
    [LUOC_VIEC_BO, sua(VB, o => { o.viec[0].han = null; o.viec[0].sua_luc = null; o.viec[0].lap = null; o.viec = Array(200).fill(o.viec[0]); })],
    [LUOC_SO_DEM, sua(SD, o => { o.viec_mo = 0; })],
  ]) { viet(f, o); assert.deepEqual(docTepXuat(f, luoc).trang_thai, 'tot', JSON.stringify(o).slice(0, 80)); }
});

test('gio_dung cũ 3 giờ 1 phút ⇒ cu (vẫn trả dữ liệu); 2 giờ 59 phút ⇒ tot; cuSauMs truyền vào được dùng', () => {
  const d = tamMoi(), f = path.join(d, 'viec-bo.json'), o = mau('viec-bo.json');
  o.gio_dung = truoc((3 * 60 + 1) * 60e3); viet(f, o);
  assert.deepEqual(docTepXuat(f, LUOC_VIEC_BO), { trang_thai: 'cu', du_lieu: o, gio_dung: o.gio_dung });
  o.gio_dung = truoc((2 * 60 + 59) * 60e3); viet(f, o);
  assert.deepEqual(docTepXuat(f, LUOC_VIEC_BO), tot(o));
  assert.equal(docTepXuat(f, LUOC_VIEC_BO, { cuSauMs: 3600e3 }).trang_thai, 'cu');
});

test('đường là symlink (tới tệp tốt) ⇒ hong; đối chứng đọc thẳng tệp đó ⇒ tot; thư mục ⇒ hong', () => {
  const d = tamMoi(), f = path.join(d, 'that.json'), l = path.join(d, 'viec-bo.json'), o = moi(mau('viec-bo.json'));
  viet(f, o); fs.symlinkSync(f, l);
  assert.deepEqual(docTepXuat(l, LUOC_VIEC_BO), hong(null));
  assert.deepEqual(docTepXuat(f, LUOC_VIEC_BO), tot(o));
  assert.deepEqual(docTepXuat(d, LUOC_VIEC_BO), hong(null));
});

test('đường là FIFO ⇒ hong ngay, không treo tiến trình (chạy trong tiến trình con hạn 5 s)', () => {
  const d = tamMoi(), p = path.join(d, 'trang-thai.json');
  assert.equal(spawnSync('/usr/bin/mkfifo', [p]).status, 0);
  const ma = `import { docTepXuat, LUOC_TRANG_THAI } from ${JSON.stringify(new URL('../may-chu/xuat.mjs', import.meta.url).href)};
    process.stdout.write(JSON.stringify(docTepXuat(${JSON.stringify(p)}, LUOC_TRANG_THAI)));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', ma], { encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL' });
  assert.equal(r.signal, null, 'treo trên FIFO'); assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), hong(null));
});

test('không có tệp ⇒ thieu (không dữ liệu); tệp tốt bị gỡ ⇒ thieu', () => {
  const d = tamMoi(), f = path.join(d, 'viec-bo.json'), o = moi(mau('viec-bo.json')), THIEU = { trang_thai: 'thieu', du_lieu: null, gio_dung: null };
  assert.deepEqual(docTepXuat(f, LUOC_VIEC_BO), THIEU);
  viet(f, o); assert.deepEqual(docTepXuat(f, LUOC_VIEC_BO), tot(o));
  fs.rmSync(f); assert.deepEqual(docTepXuat(f, LUOC_VIEC_BO), THIEU);
});

test('ghiSoDem: chỉ số (việc BIMAT-123 không lọt vào tệp), đếm đúng theo giờ VN, ghi nguyên tử (thay symlink cài sẵn, inode mới), 0644 dù umask 077, đọc lại ⇒ tot', () => {
  const d = tamMoi(), db = moKho(), luc = '2026-11-12T03:00:00.000Z';   // 10:00 giờ VN
  let so = 0;
  const ghi = ops => apGoi(db, { khoa_lap: `so-dem-${String(++so).padStart(4, '0')}`, chu_the: 'anh', nguon: { loai: 'web' }, ops }, luc).ket_qua;
  const them = truong => ({ loai: 'them', bang: 'viec', truong });
  const [, , , , , xong, xoa] = ghi([
    them({ tieu_de: 'BIMAT-123' }), them({ tieu_de: 'Quá hạn hôm qua', han: '2026-11-11' }), them({ tieu_de: 'Hạn hôm nay', han: '2026-11-12' }),
    them({ tieu_de: 'Quá giờ sáng nay', han: '2026-11-12T09:00' }), them({ tieu_de: 'Chiều nay', han: '2026-11-12T11:00' }),
    them({ tieu_de: 'Đã xong', han: '2026-11-01' }), them({ tieu_de: 'Đã xoá', han: '2026-11-01' }),
  ]);
  ghi([{ loai: 'xong', bang: 'viec', id: xong.id, phien_ban: 1 }, { loai: 'xoa', bang: 'viec', id: xoa.id, phien_ban: 1 }]);
  ghi([
    { loai: 'them', bang: 'lich', truong: { tieu_de: 'Sáng nay', bat_dau: '2026-11-12T08:00' } },
    { loai: 'them', bang: 'lich', truong: { tieu_de: 'Ba ngày', bat_dau: '2026-11-11', ket_thuc: '2026-11-13' } },
    { loai: 'them', bang: 'lich', truong: { tieu_de: 'Mai', bat_dau: '2026-11-13T08:00' } },
    { loai: 'them', bang: 'lich', truong: { tieu_de: 'Hôm qua', bat_dau: '2026-11-11T08:00' } },
  ]);
  const deXuat = db.prepare("INSERT INTO de_xuat (id, mach, chu_the, noi_dung, ops, trang_thai, tao_luc, sua_luc, nguoi_sua) VALUES (?, 'cos', 'neo', 'BIMAT-456', '[]', ?, ?, ?, 'neo')");
  deXuat.run('dx1', 'cho', luc, luc); deXuat.run('dx2', 'bo_qua', luc, luc);
  const f = path.join(d, 'so-dem.json'), nanNhan = path.join(d, 'nan-nhan.txt');
  fs.writeFileSync(nanNhan, 'GIU'); fs.symlinkSync(nanNhan, f);
  const inoCu = fs.statSync(nanNhan).ino, cu = process.umask(0o077);
  try { ghiSoDem(db, d, new Date(luc)); } finally { process.umask(cu); }
  const tho = fs.readFileSync(f, 'utf8'), o = JSON.parse(tho);
  assert.deepEqual(o, { luoc_do: 1, gio_dung: luc, viec_mo: 5, qua_han: 2, lich_hom_nay: 2, de_xuat_cho: 1 });
  assert.ok(!tho.includes('BIMAT') && !tho.includes('Quá hạn'), 'lọt chữ vào so-dem.json');
  assert.ok(Object.entries(o).every(([k, v]) => k === 'gio_dung' || typeof v === 'number'));
  assert.ok(fs.lstatSync(f).isFile() && fs.statSync(f).ino !== inoCu, 'phải thay bằng tệp mới (đổi tên), không ghi xuyên symlink');
  assert.equal(fs.readFileSync(nanNhan, 'utf8'), 'GIU');
  assert.equal(fs.statSync(f).mode & 0o777, 0o644);
  assert.deepEqual(fs.readdirSync(d).sort(), ['nan-nhan.txt', 'so-dem.json'], 'không còn tệp tạm');
  assert.equal(docTepXuat(f, LUOC_SO_DEM, { cuSauMs: Infinity }).trang_thai, 'tot');
  db.close();
});

test('ghiSoDem: đổi tên lỗi (chỗ so-dem.json là thư mục) ⇒ ném, không để tệp tạm', () => {
  const d = tamMoi(), db = moKho();
  fs.mkdirSync(path.join(d, 'so-dem.json', 'x'), { recursive: true });
  assert.throws(() => ghiSoDem(db, d, new Date()));
  assert.deepEqual(fs.readdirSync(d), ['so-dem.json']);
  db.close();
});
