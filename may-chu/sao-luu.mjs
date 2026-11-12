// Sao lưu kho + diễn tập khôi phục (thiết kế v0.2 mục 5.6). Chuyển thể từ Family Hub main:hub/sao-luu.mjs:
// dấu vân tay theo MỌI bảng của kho (Hub băm cứng muc/ops), hai loại bản (giờ/ngày), bộ hẹn setTimeout theo đồng hồ thay được.
// VACUUM INTO tệp tạm 0600 ⇒ integrity_check ⇒ dấu khớp bản sống ⇒ ghi dấu <tep>.json ⇒ đổi tên; lỗi ⇒ không đụng bản cũ.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const GIU = { gio: 48, ngay: 14 };   // GIẢ ĐỊNH (plan mục 6)
const TEN = { gio: /^kho-gio-\d{8}-\d{4}\.sqlite$/, ngay: /^kho-ngay-\d{8}-\d{4}\.sqlite$/ };
const GIO = 3600e3, NGAY = 24 * GIO, VN = 7 * GIO;   // giờ VN = UTC+7, không đổi giờ (GIẢ ĐỊNH như thiết kế)

// { so_dong, bam } theo từng bảng (bỏ sqlite_*); dòng xếp theo MỌI cột: không dựa rowid (VACUUM được phép đánh lại rowid).
export function dauVanTay(db) {
  const so_dong = {}, bam = {};
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND substr(name, 1, 7) <> 'sqlite_' ORDER BY name").all()) {
    const cot = db.prepare('SELECT count(*) AS n FROM pragma_table_info(?)').get(name).n, h = crypto.createHash('sha256');
    let n = 0;
    for (const r of db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY ${Array.from({ length: cot }, (_, i) => i + 1).join(', ')}`).iterate()) {
      h.update(JSON.stringify(r)); h.update('\n'); n++;
    }
    so_dong[name] = n; bam[name] = h.digest('hex');
  }
  return { so_dong, bam };
}

const chuoiDau = d => JSON.stringify(Object.keys(d.so_dong).sort().map(b => [b, d.so_dong[b], d.bam[b]]));
export function cungDau(a, b) {
  return chuoiDau(a) === chuoiDau(b);
}

export function kiemBan(tep) {
  const db = new DatabaseSync(tep, { readOnly: true });
  try {
    if (Object.values(db.prepare('PRAGMA integrity_check').get())[0] !== 'ok') throw new Error('sao lưu: integrity_check hỏng');
    return dauVanTay(db);
  } finally { db.close(); }
}

const gioTen = bayGio => new Date(new Date(bayGio).getTime() + VN).toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');

export function saoLuu(db, thuMuc, bayGio, loai) {
  if (!Object.hasOwn(GIU, loai)) throw new Error('sao lưu: loai phải là gio hoặc ngay');
  fs.mkdirSync(thuMuc, { recursive: true, mode: 0o700 });
  const dich = path.join(thuMuc, `kho-${loai}-${gioTen(bayGio)}.sqlite`), tam = dich + '.tam', jTam = dich + '.json.tam';
  const don = () => { fs.rmSync(tam, { force: true }); fs.rmSync(jTam, { force: true }); };
  don();
  const dau = dauVanTay(db);
  let jXong = false;
  try {
    fs.closeSync(fs.openSync(tam, 'wx', 0o600));   // VACUUM INTO ghi vào tệp rỗng có sẵn ⇒ bản sao 0600 ngay từ byte đầu
    db.prepare('VACUUM INTO ?').run(tam);
    if (!cungDau(kiemBan(tam), dau)) throw new Error('sao lưu: bản sao lệch bản sống');
    fs.writeFileSync(jTam, JSON.stringify(dau), { mode: 0o600, flag: 'wx' });
    fs.renameSync(jTam, dich + '.json'); jXong = true;   // dấu nguyên vẹn TRƯỚC, rồi mới tới bản .sqlite: không có bản nào thiếu dấu
    fs.renameSync(tam, dich);
  } catch (e) { don(); if (jXong) fs.rmSync(dich + '.json', { force: true }); throw e; }   // hỏng hay đĩa đầy: KHÔNG đụng bản cũ
  for (const f of fs.readdirSync(thuMuc).filter(f => TEN[loai].test(f)).sort().slice(0, -GIU[loai])) {
    fs.rmSync(path.join(thuMuc, f)); fs.rmSync(path.join(thuMuc, f + '.json'), { force: true });
  }
  return { tep: dich, dau };
}

// Diễn tập: chép bản sao vào thư mục tạm, mở, integrity_check, so số dòng + băm từng bảng với dấu ghi lúc sao lưu (<tep>.json).
export function diTapKhoiPhuc(tep, thuMucTam) {
  const mong = JSON.parse(fs.readFileSync(tep + '.json', 'utf8')), chep = path.join(thuMucTam, 'khoi-phuc-thu.sqlite');
  fs.copyFileSync(tep, chep);
  try {
    const ra = kiemBan(chep);
    return { khop: cungDau(ra, mong), mong, ra };
  } finally { fs.rmSync(chep, { force: true }); }
}

// ms tới mốc kế tiếp, CHẶT sau t, của chu kỳ `chuKy` lệch `lech` so với mốc 0 UTC.
const toiMoc = (t, chuKy, lech) => chuKy - (((t - lech) % chuKy) + chuKy) % chuKy;
const DONG_HO = { now: () => Date.now(), setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: t => clearTimeout(t) };
const sach = e => String(e?.message ?? e).slice(0, 200).replace(/[\x00-\x1f\x7f]/g, ' ');

// Bản giờ mỗi giờ tròn + bản ngày 03:00 giờ VN. Mỗi lần chạy tính mốc kế từ dongHo.now() rồi setTimeout (không setInterval dài).
// moiGio(t): việc phụ sau mỗi bản giờ (A6: ghi so-dem.json); lỗi của nó và lỗi sao lưu không chặn nhau.
export function henSaoLuu(db, ch, { dongHo = DONG_HO, ghiLog = s => process.stderr.write(s + '\n'), moiGio } = {}) {
  const hen = {};
  const dat = (loai, chuKy, lech, tu = dongHo.now()) => {
    const moc = tu + toiMoc(tu, chuKy, lech);
    hen[loai] = dongHo.setTimeout(() => {
      const t = Math.max(dongHo.now(), moc);   // timer bắn sớm vài ms: vẫn dùng mốc tròn cho tên tệp VÀ mốc kế (không thêm bản 1 ms sau)
      try { ghiLog(`sao lưu ${loai} xong ${path.basename(saoLuu(db, ch.thuMucSaoLuu, t, loai).tep)}`); }
      catch (e) { ghiLog(`LỖI sao lưu ${loai}: ${sach(e)}`); }   // lỗi không được ném ra bộ hẹn (sập tiến trình); lần kế vẫn hẹn
      if (loai === 'gio' && moiGio) { try { moiGio(t); } catch { ghiLog('LỖI ghi so đếm'); } }
      dat(loai, chuKy, lech, t);
    }, moc - dongHo.now());
    hen[loai]?.unref?.();
  };
  dat('gio', GIO, 0);
  dat('ngay', NGAY, 3 * GIO - VN);
  return { dung() { for (const t of Object.values(hen)) dongHo.clearTimeout(t); } };
}
