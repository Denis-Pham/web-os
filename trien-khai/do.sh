#!/bin/bash
# Đặt bản giao diện web-os chờ anh duyệt (thiết kế v0.2 mục 6). Dùng: do.sh dat-ban <SHA40>
# Chép web/ của commit <SHA40> sang <WO_CHO>/ban/<SHA40> (mặc định /Users/Shared/web-os). KHÔNG lật link, KHÔNG chạm bản đang phục vụ:
# duyệt/lùi là việc máy chủ (POST /api/ban/duyet, /api/ban/lui). Khung Learning 630a0bf:trien-khai/do.sh, bỏ phần lật hien-tai/truoc.
# Cổng thật (tên, đuôi, cỡ, symlink, chủ tệp) ở máy chủ khi xem + duyệt; ở đây chỉ chặn SHA sai, commit không có web/.
set -euo pipefail
trap 'exit 143' TERM
trap 'exit 130' INT
trap 'exit 129' HUP

ThuMuc="$(cd "$(dirname "$0")" && pwd)"
CHO="${WO_CHO:-/Users/Shared/web-os}"
REPO="${WO_REPO:-$(cd "${ThuMuc}/.." && pwd)}"
tam=""
don() { if [[ -n "${tam}" && -d "${tam}" ]]; then rm -rf "${tam}"; fi; }
trap don EXIT

loi() { echo "LOI: $*" >&2; exit 1; }

dat_ban() {
  local sha="${1:-}"
  [[ "${sha}" =~ ^[0-9a-f]{40}$ ]] || loi "SHA phải đúng 40 hex thường"
  [[ -d "${CHO}/ban" ]] || loi "chưa có ${CHO}/ban (lễ tạo, neo ghi, _webos đọc)"
  if [[ -d "${CHO}/ban/${sha}" ]]; then echo "DAT-BAN: ĐẠT ${sha}"; return; fi   # đặt lại cùng SHA: giữ bản đã đặt
  git -C "${REPO}" cat-file -e "${sha}^{commit}" 2>/dev/null || loi "không có commit ${sha}"
  tam="$(mktemp -d "${CHO}/.tam.XXXXXX")"
  git -C "${REPO}" archive "${sha}" web | tar -x -C "${tam}" || loi "không xuất được web/ của ${sha}"
  [[ -d "${tam}/web" ]] || loi "commit không có web/"
  # _webos đọc được dù umask của neo là 077
  find "${tam}/web" -type d -exec chmod 755 {} +
  find "${tam}/web" -type f -exec chmod 644 {} +
  mv "${tam}/web" "${CHO}/ban/${sha}"
  echo "DAT-BAN: ĐẠT ${sha}"
}

case "${1:-}" in
  dat-ban) dat_ban "${2:-}" ;;
  *) echo "dùng: do.sh dat-ban <SHA40>" >&2; exit 2 ;;
esac
