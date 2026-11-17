// Dựng nút DOM — không bao giờ ghép chuỗi HTML (thiết kế 8, 13). Thuộc tính qua kiemThuocTinh (cấm style / on* / innerHTML);
// con là chuỗi ⇒ nút chữ (append), null/false/undefined ⇒ bỏ. Biểu tượng SVG dựng bằng createElementNS. Ngày giờ hiện theo giờ VN (UTC+7, không đổi giờ).
const kiemThuocTinh = k => { if (k === 'style' || k.startsWith('on') || k === 'innerHTML') throw new Error('thuộc tính cấm: ' + k); };

export function el(tag, thuoc = {}, ...con) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(thuoc)) {
    kiemThuocTinh(k);
    if (v === null || v === false || v === undefined) continue;
    n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of con) if (c !== null && c !== false && c !== undefined) n.append(c);
  return n;
}

const NS = 'http://www.w3.org/2000/svg';
const BIEU_TUONG = {
  'mo-menu': 'M4 6h16M4 12h16M4 18h16',
  'ra-ngoai': 'M8 16 16 8M10 8h6v6',
  them: 'M12 5v14M5 12h14',
  xong: 'm5 12 4 4 10-10',
  dong: 'M6 6l12 12M18 6 6 18',
  // 12 mạch + khiên + mũi tên: đường vẽ của bản Sổ (demo/codex app.js:3–21)
  chu: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
  cos: 'M8 3H5v18h14V3h-3M9 2h6v4H9ZM8 11h8M8 16h5',
  hoc: 'M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3ZM12 6v15',
  'y-tuong': 'M9 18h6M10 22h4M8 14a7 7 0 1 1 8 0l-1 4H9Z',
  'tri-thuc': 'M4 3h4v18H4ZM10 3h4v18h-4ZM16 5l4-1 4 16-4 1Z',
  factory: 'M3 21V10l6 3V7l6 4V3h5v18ZM6 17h1M11 17h1M16 17h1',
  'tai-chinh': 'M3 5h17v15H3ZM3 5V3h14M15 10h6v6h-6Z',
  'dau-tu': 'M3 3v18h18M6 16l5-5 4 3 6-8M17 6h4v4',
  creator: 'M3 5h13v14H3ZM16 10l6-4v12l-6-4ZM8 9l4 3-4 3Z',
  'nao-chung': 'M12 3v18M12 6C9 0 3 4 5 9c-5 2-3 10 2 10 0 4 5 3 5-1M12 6c3-6 9-2 7 3 5 2 3 10-2 10 0 4-5 3-5-1',
  sia: 'M3 21h18M5 21V10M10 21V10M14 21V10M19 21V10M2 10l10-7 10 7Z',
  'toa-an': 'M12 3v18M7 21h10M4 7h16M4 7l-3 7a3 3 0 0 0 6 0ZM20 7l-3 7a3 3 0 0 0 6 0Z',
  khien: 'm12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5ZM8 11l3 3 5-5',
  'mui-ten': 'M5 12h14M13 6l6 6-6 6',
};
export function svg(nom) {
  const s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
  for (const [k, v] of [['viewBox', '0 0 24 24'], ['fill', 'none'], ['aria-hidden', 'true'], ['class', 'bt']]) s.setAttribute(k, v);
  p.setAttribute('d', Object.hasOwn(BIEU_TUONG, nom) ? BIEU_TUONG[nom] : '');
  for (const [k, v] of [['stroke', 'currentColor'], ['stroke-width', '1.5'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round']]) p.setAttribute(k, v);
  s.append(p);
  return s;
}

const hai = n => String(n).padStart(2, '0');
// 'YYYY-MM-DD…' ⇒ 'dd/mm/yyyy'; sai dạng ⇒ ''.
export function ngayVN(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
// ISO ⇒ 'HH:MM dd/mm' giờ VN; Date.parse sai ⇒ ''.
export function gioVN(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t + 7 * 3600e3);
  return `${hai(d.getUTCHours())}:${hai(d.getUTCMinutes())} ${hai(d.getUTCDate())}/${hai(d.getUTCMonth() + 1)}`;
}
