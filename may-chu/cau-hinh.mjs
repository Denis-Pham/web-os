// Cấu hình web-os: tệp JSON khoá ĐÓNG (thiết kế v0.2 mục 1, 5.3; plan A2). Khoá lạ, thiếu khoá bắt buộc, sai kiểu ⇒ ném, máy chủ không nghe gì.
// A2 chỉ bắt buộc các khoá A2 dùng; khoá còn lại trong danh sách đóng là tuỳ chọn (task sau dùng). teamDomain/aud kiểm dạng ở taoKiemJwt.
// cong CHỈ cho dev (127.0.0.1); production nghe ngheSocket — có cả hai, hoặc không có cái nào ⇒ từ chối.
import fs from 'node:fs';
import path from 'node:path';

const BAT_BUOC = ['teamDomain', 'aud', 'emails', 'ngheKernel', 'thuMucKho', 'cosGhi'];
const TUY_CHON = ['ngheSocket', 'cong', 'thuMucBan', 'thuMucCho', 'uidCho', 'thuMucXuat', 'thuMucXuatVao', 'thuMucSaoLuu', 'tepKhoaAI'];
const DUONG = ['ngheSocket', 'ngheKernel', 'thuMucKho', 'thuMucBan', 'thuMucCho', 'thuMucXuat', 'thuMucXuatVao', 'thuMucSaoLuu', 'tepKhoaAI'];

export function docCauHinh(duong) {
  let ch;
  try { ch = JSON.parse(fs.readFileSync(duong, 'utf8')); } catch { throw new Error('cấu hình: không đọc được JSON'); }   // không in thông điệp JSON.parse (có thể trích nội dung tệp)
  if (!ch || typeof ch !== 'object' || Array.isArray(ch)) throw new Error('cấu hình: không phải object');
  for (const k of Object.keys(ch)) if (!BAT_BUOC.includes(k) && !TUY_CHON.includes(k)) throw new Error('cấu hình: khoá lạ ' + k);
  for (const k of BAT_BUOC) if (!Object.hasOwn(ch, k)) throw new Error('cấu hình: thiếu ' + k);
  if (Object.hasOwn(ch, 'cong') === Object.hasOwn(ch, 'ngheSocket')) throw new Error('cấu hình: cần đúng một trong cong (chỉ dev) và ngheSocket');
  if (!Array.isArray(ch.emails) || !ch.emails.length || !ch.emails.every(e => typeof e === 'string' && /^[^@\s]+@[^@\s]+$/.test(e))) throw new Error('cấu hình: emails sai');
  if (typeof ch.cosGhi !== 'boolean') throw new Error('cấu hình: cosGhi phải là true/false');
  if (Object.hasOwn(ch, 'cong') && (!Number.isInteger(ch.cong) || ch.cong < 0 || ch.cong > 65535)) throw new Error('cấu hình: cong sai');
  if (Object.hasOwn(ch, 'uidCho') && (!Number.isInteger(ch.uidCho) || ch.uidCho < 0)) throw new Error('cấu hình: uidCho phải là số nguyên ≥ 0');
  for (const k of DUONG) if (Object.hasOwn(ch, k) && (typeof ch[k] !== 'string' || !path.isAbsolute(ch[k]) || ch[k].includes('\0'))) throw new Error('cấu hình: ' + k + ' phải là đường tuyệt đối');
  if (ch.ngheKernel === ch.ngheSocket) throw new Error('cấu hình: ngheKernel trùng ngheSocket');   // nghe() sẽ gỡ socket web của chính mình để thay bằng kernel
  return { ngheSocket: null, ...ch };
}
