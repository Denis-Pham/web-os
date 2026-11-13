// Hỏi AI CoS (thiết kế 5.7, 13; plan B3): AI CHỈ đề xuất. Gợi ý của model là DỮ LIỆU: khoá đóng + lược đồ ghi (kiemOps) + kiemDeXuatAI
// rồi thành MỘT dòng de_xuat 'cho'; lệnh ghi chỉ sinh khi anh bấm Áp dụng (apDungDeXuat kiểm lại). Model không có công cụ, không gọi apGoi.
// Khung chép từ Family Hub main:hub/hoi-ai.mjs (docKhoaProxy :20–28, taoGoiProxy :31–48), lỗi đổi sang LoiGoi.
import fs from 'node:fs';
import { LoiGoi, taoDeXuat } from './goi.mjs';

export const URL_AI = 'http://127.0.0.1:8317/v1/chat/completions', MODEL_AI = 'gemini-3.8-flash-high';
const BAN = () => new LoiGoi(503, 'ai_ban');

// Khoá proxy: tệp 0600 của chính người chạy máy chủ, đọc MỖI lượt gọi (xoay khoá không phải khởi động lại).
export function docKhoaAI(tep) {
  const THIEU = () => new LoiGoi(500, 'khoa_ai_thieu');
  let st; try { st = fs.statSync(tep); } catch { throw THIEU(); }
  if (!st.isFile()) throw THIEU();   // thư mục / FIFO: không mở ra đọc (FIFO chặn event loop)
  if ((st.mode & 0o077) !== 0 || st.uid !== process.getuid()) throw new LoiGoi(500, 'khoa_ai_quyen');
  let k; try { k = fs.readFileSync(tep, 'utf8').trim(); } catch { throw THIEU(); }
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(k)) throw new LoiGoi(500, 'khoa_ai_dang');
  return k;
}

// Thân yêu cầu KHÔNG có trường công cụ (5.7). redirect manual: dữ liệu + khoá chỉ tới url cấu hình, 3xx ⇒ 502.
export function taoGoiAI({ khoa, url = URL_AI, model = MODEL_AI, hetGio = 60000 }) {
  return async messages => {
    const k = khoa();   // khoá thiếu / sai quyền / sai dạng ⇒ 500 và không gọi, không giả làm «AI đang bận»
    let r;
    try {
      r = await fetch(url, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + k }, body: JSON.stringify({ model, messages, temperature: 0.2, reasoning_effort: 'low', response_format: { type: 'json_object' } }), signal: AbortSignal.timeout(hetGio) });
    } catch { throw BAN(); }   // proxy tắt hoặc quá giờ
    if (r.status === 429 || r.status === 503) throw BAN();
    if (!r.ok) throw new LoiGoi(502, 'ai_loi');
    let j;
    try { j = await r.json(); } catch (e) {
      if (e?.name === 'TimeoutError' || e?.name === 'AbortError') throw BAN();   // hết giờ lúc đang đọc thân = bận, không phải «sai dạng»
      j = null;
    }
    return j?.choices?.[0]?.message?.content ?? '';
  };
}

// Gửi model đúng 4 trường của việc mở có hạn (không ghi_chu / danh_sach).
export function tinNhanCos(viec, homNay) {
  return [
    { role: 'system', content: 'Bạn là trợ lý việc của anh. Chỉ trả JSON {"noi_dung": chuỗi ≤ 500 ký tự, không HTML, "ops": [đúng 1 {"loai":"sua","bang":"viec","id","phien_ban","truong":{"han":"YYYY-MM-DD"}}]}; '
      + 'đề xuất dời hạn đúng MỘT việc đang mở trong danh sách (id và phien_ban chép đúng từ danh sách), noi_dung nói ngắn vì sao. Không thêm khoá nào khác.' },
    { role: 'user', content: JSON.stringify({ hom_nay: homNay, viec: viec.map(({ id, tieu_de, han, phien_ban }) => ({ id, tieu_de, han, phien_ban })) }) },
  ];
}

// JSON object khoá đóng {noi_dung, ops}; noi_dung chuỗi 1–500 ký tự; có < hay > ⇒ chặn (không HTML). ops để kiemOps + kiemDeXuatAI kiểm.
export function docDeXuat(chu) {
  let o; try { o = JSON.parse(chu); } catch { return null; }
  if (typeof o !== 'object' || o === null || Array.isArray(o) || Object.keys(o).sort().join() !== 'noi_dung,ops') return null;
  if (typeof o.noi_dung !== 'string' || [...o.noi_dung].length < 1 || [...o.noi_dung].length > 500) return null;
  if (/[<>]/.test(o.noi_dung)) return null;
  return { noi_dung: o.noi_dung, ops: o.ops };
}

// Một lượt một lúc (cờ trên ctx): lượt hai trong lúc chờ model ⇒ 429. Đề xuất bị lược đồ/kiemDeXuatAI chặn ⇒ 200 { de_xuat: null, ly_do }.
export async function hoiAICos(ctx) {
  if (ctx.dangHoi) throw new LoiGoi(429, 'ai_dang_hoi');
  ctx.dangHoi = true;
  try {
    const viec = ctx.db.prepare('SELECT id, tieu_de, han, phien_ban FROM viec WHERE xoa_luc IS NULL AND xong_luc IS NULL AND han IS NOT NULL ORDER BY han, id LIMIT 100').all();
    if (viec.length === 0) return { de_xuat: null, ly_do: 'khong_co_viec' };
    const chu = await ctx.goiAI(tinNhanCos(viec, new Date(ctx.bayGio() + 7 * 3600e3).toISOString().slice(0, 10)));   // hôm nay giờ VN (UTC+7)
    const d = docDeXuat(chu);
    if (!d) return { de_xuat: null, ly_do: 'sai_dang' };
    const iso = new Date(ctx.bayGio()).toISOString();
    try {
      const { id } = taoDeXuat(ctx.db, { mach: 'cos', chu_the: 'ai', noi_dung: d.noi_dung, ops: d.ops }, iso);
      return { de_xuat: { id, noi_dung: d.noi_dung, ops: d.ops } };
    } catch (e) {
      if (e instanceof LoiGoi && (e.ma === 400 || e.ma === 409)) return { de_xuat: null, ly_do: e.chi_tiet?.ly_do ?? e.loi };
      throw e;
    }
  } finally { ctx.dangHoi = false; }
}
