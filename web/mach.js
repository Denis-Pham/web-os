// 12 mạch của thanh trái (MACH demo app.js:25–29) và màn của 10 mạch chưa có màn riêng (R7: 12 trừ chu, cos): tiêu đề, một dòng mô tả
// (không số mẫu), khối «chưa nối». hoc ⇒ liên kết Learning từ lien-ket.json; href chỉ nhận https: (khác ⇒ «chưa nối»).
import { el, svg } from './dom.js';

const KHAC = [
  ['hoc', 'Học tiếng Anh', 'Luyện nghe, nói, viết mỗi ngày và giữ lại những từ muốn dùng.'],
  ['y-tuong', 'Ý tưởng', 'Cất những điều chợt đến, nối các mảnh rời và chọn thứ đáng bắt tay vào làm.'],
  ['tri-thuc', 'Kho tri thức', 'Những điều học được có chỗ ở lâu dài, nối với nhau theo chủ đề.'],
  ['factory', 'Xưởng tự động', 'Theo dõi một yêu cầu đi qua các bước viết mã, kiểm tra và chờ duyệt.'],
  ['sia', 'Hội đồng SIA', 'Những vụ cần anh chọn hướng, kèm lý lẽ của từng bên.'],
  ['toa-an', 'Toà án', 'Soát lại các tín hiệu đã có trước khi chốt một quyết định.'],
  ['tai-chinh', 'Chi tiêu', 'Một góc nhìn gọn về thu chi cá nhân hằng ngày.'],
  ['dau-tu', 'Đầu tư', 'Xem lại phân bổ, ghi lý do lựa chọn và theo dõi kế hoạch dài hạn.'],
  ['creator', 'Làm video', 'Gom ý, viết lời kể và theo dõi từng video.'],
  ['nao-chung', 'Não chung', 'Bản đồ ký ức về cách anh làm việc, dùng chung cho các trợ lý.'],
];
export const MACH = [['chu', 'Hôm nay'], ['cos', 'Việc & lịch'], ...KHAC.map(([id, ten]) => [id, ten])];

let LK = null;
export const lienKet = () => (LK ??= fetch('/lien-ket.json', { cache: 'no-store', redirect: 'manual' })
  .then(r => (r.ok ? r.json() : {})).catch(() => ({})));
export function urlNgoai(s) {
  try { const u = new URL(s); return u.protocol === 'https:' ? u.href : null; } catch { return null; }
}
export const chuaNoi = (chu = 'chưa nối') => el('p', { class: 'chua-noi', 'data-chua-noi': '' }, chu);
export const lienKetNgoai = (href, chu) => el('a', { class: 'lk-ngoai', href, target: '_blank', rel: 'noopener noreferrer' }, chu, svg('ra-ngoai'));

export const MAN = KHAC.map(([id, ten, moTa]) => ({
  id, ten,
  async ve(goc) {
    const than = el('div', { class: 'the' }, el('p', {}, moTa));
    goc.append(el('div', { class: 'dau-man' }, el('h1', {}, ten)), than);
    if (id !== 'hoc') { than.append(chuaNoi()); return; }
    const href = urlNgoai((await lienKet()).learning);
    than.append(href ? lienKetNgoai(href, 'Mở trang Learning') : chuaNoi('Trang Learning: chưa nối'));
  },
  don() {},
}));
