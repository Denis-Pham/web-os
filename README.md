# web-os

Cổng web AI Personal OS của anh: máy chủ Node `web-os` giữ kho SQLite local (việc, lịch CoS), nghe `web.sock` (cloudflared, vé Access)
và `kernel.sock` (Hermes Kernel). Node thuần ESM, không npm; test bằng `node --test 'test-may-chu/*.test.mjs'` (Node 26 coi dạng thư mục là module ⇒ đỏ sai lý do).
Chạy: `node may-chu/may-chu.mjs <cau-hinh.json>` (khoá đóng: `may-chu/cau-hinh.mjs`).

Thiết kế: `Project Neo/web-os-nhap/thiet-ke-v0.2.md` · Plan: `Project Neo/web-os-nhap/plan-thi-cong.md` (Gói 1, nhánh `goi-1`).
