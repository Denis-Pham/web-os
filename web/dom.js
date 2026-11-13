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
};
export function svg(nom) {
  const s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
  for (const [k, v] of [['viewBox', '0 0 24 24'], ['fill', 'none'], ['aria-hidden', 'true'], ['class', 'bt']]) s.setAttribute(k, v);
  p.setAttribute('d', BIEU_TUONG[nom] ?? '');
  p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '1.8');
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
