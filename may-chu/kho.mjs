// Kho SQLite của web-os (thiết kế v0.2 mục 2): bảng dữ liệu + sổ gói ghi + nhật ký chỉ thêm. Khung moKho/trongGiaoDich theo Hub (hub/kho.mjs).
// MỘT dịch vụ giữ kho: mọi lệnh ghi đi qua apGoi (goi.mjs), không ai khác mở tệp này.
import { DatabaseSync } from 'node:sqlite';

const SQL = `
CREATE TABLE IF NOT EXISTS luoc_do (phien INTEGER NOT NULL);
INSERT INTO luoc_do (phien) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM luoc_do);
CREATE TABLE IF NOT EXISTS viec (
  id TEXT PRIMARY KEY, tieu_de TEXT NOT NULL CHECK (length(tieu_de) BETWEEN 1 AND 200),
  han TEXT, danh_sach TEXT, ghi_chu TEXT CHECK (ghi_chu IS NULL OR length(ghi_chu) <= 2000),
  xong_luc TEXT, mach TEXT NOT NULL DEFAULT 'cos', nguon_gieo TEXT,
  phien_ban INTEGER NOT NULL DEFAULT 1, tao_luc TEXT NOT NULL, sua_luc TEXT NOT NULL,
  nguoi_sua TEXT NOT NULL, xoa_luc TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS viec_nguon_gieo ON viec(nguon_gieo) WHERE nguon_gieo IS NOT NULL;
CREATE TABLE IF NOT EXISTS lich (
  id TEXT PRIMARY KEY, tieu_de TEXT NOT NULL CHECK (length(tieu_de) BETWEEN 1 AND 200),
  bat_dau TEXT NOT NULL, ket_thuc TEXT, ca_ngay INTEGER NOT NULL DEFAULT 0 CHECK (ca_ngay IN (0,1)),
  nhac_truoc_phut INTEGER CHECK (nhac_truoc_phut IS NULL OR nhac_truoc_phut BETWEEN 0 AND 10080),
  dia_diem TEXT CHECK (dia_diem IS NULL OR length(dia_diem) <= 200),
  phien_ban INTEGER NOT NULL DEFAULT 1, tao_luc TEXT NOT NULL, sua_luc TEXT NOT NULL,
  nguoi_sua TEXT NOT NULL, xoa_luc TEXT);
CREATE TABLE IF NOT EXISTS cai_tien (
  id TEXT PRIMARY KEY, ngay TEXT NOT NULL, mach TEXT NOT NULL, loai TEXT NOT NULL, mon TEXT NOT NULL,
  duong TEXT, noi_dung TEXT NOT NULL CHECK (length(noi_dung) <= 2000),
  trang_thai TEXT NOT NULL CHECK (trang_thai IN ('cho','da_nhap','bo')),
  phien_ban INTEGER NOT NULL DEFAULT 1, tao_luc TEXT NOT NULL, sua_luc TEXT NOT NULL,
  nguoi_sua TEXT NOT NULL, xoa_luc TEXT);
CREATE TABLE IF NOT EXISTS y_tuong (id TEXT PRIMARY KEY, tieu_de TEXT NOT NULL, noi_dung TEXT, chu_de TEXT,
  trang_thai TEXT, phien_ban INTEGER NOT NULL DEFAULT 1, tao_luc TEXT NOT NULL, sua_luc TEXT NOT NULL,
  nguoi_sua TEXT NOT NULL, xoa_luc TEXT);
CREATE TABLE IF NOT EXISTS tien_do (id TEXT PRIMARY KEY, doi_tuong TEXT NOT NULL, ghi TEXT,
  phan_tram INTEGER CHECK (phan_tram IS NULL OR phan_tram BETWEEN 0 AND 100), phien_ban INTEGER NOT NULL DEFAULT 1,
  tao_luc TEXT NOT NULL, sua_luc TEXT NOT NULL, nguoi_sua TEXT NOT NULL, xoa_luc TEXT);
CREATE TABLE IF NOT EXISTS goi_ghi (
  id TEXT PRIMARY KEY, khoa_lap TEXT NOT NULL UNIQUE, chu_the TEXT NOT NULL, nguon TEXT NOT NULL,
  ops TEXT NOT NULL, ket_qua TEXT NOT NULL, ma_hoan TEXT UNIQUE, hoan_cua TEXT, hoan_luc TEXT, tao_luc TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS nhat_ky (
  id INTEGER PRIMARY KEY AUTOINCREMENT, luc TEXT NOT NULL, chu_the TEXT NOT NULL, nguon TEXT NOT NULL,
  goi_id TEXT NOT NULL, bang TEXT NOT NULL, dong_id TEXT NOT NULL, truoc TEXT, sau TEXT);
CREATE TRIGGER IF NOT EXISTS nhat_ky_khong_sua BEFORE UPDATE ON nhat_ky BEGIN SELECT RAISE(ABORT, 'nhat_ky_chi_them'); END;
CREATE TRIGGER IF NOT EXISTS nhat_ky_khong_xoa BEFORE DELETE ON nhat_ky BEGIN SELECT RAISE(ABORT, 'nhat_ky_chi_them'); END;
CREATE TABLE IF NOT EXISTS de_xuat (
  id TEXT PRIMARY KEY, mach TEXT NOT NULL, chu_the TEXT NOT NULL, noi_dung TEXT NOT NULL CHECK (length(noi_dung) <= 2000),
  ops TEXT NOT NULL, trang_thai TEXT NOT NULL CHECK (trang_thai IN ('cho','bo_qua','ap_dung')),
  goi_id TEXT, phien_ban INTEGER NOT NULL DEFAULT 1, tao_luc TEXT NOT NULL, sua_luc TEXT NOT NULL, nguoi_sua TEXT NOT NULL);
`;

export function moKho(duong = ':memory:') {
  const db = new DatabaseSync(duong);
  db.exec('PRAGMA busy_timeout = 5000');
  if (duong !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec(SQL);
  return db;
}

export function trongGiaoDich(db, f) {
  db.exec('BEGIN IMMEDIATE');
  // SQLITE_FULL: SQLite có thể đã tự lùi; ROLLBACK lúc không còn giao dịch sẽ ném lỗi khác, đè mất lỗi gốc (spec §14).
  try { const r = f(); db.exec('COMMIT'); return r; } catch (e) { if (db.isTransaction) db.exec('ROLLBACK'); throw e; }
}
