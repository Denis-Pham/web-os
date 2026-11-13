#!/bin/bash
# Khuôn L8: mỗi tệp trong web/ (hoặc thư mục đối số) ≤ 20 480 byte. In tên tệp vượt + «KICH-THUOC: TRƯỢT» (rc 1), không thì «KICH-THUOC: ĐẠT».
set -u
goc="${1:-$(cd "$(dirname "$0")/.." && pwd)/web}"
if [ ! -d "${goc}" ]; then echo "thiếu thư mục ${goc}"; echo 'KICH-THUOC: TRƯỢT'; exit 1; fi
truot=0
for f in "${goc}"/*; do
  [ -f "${f}" ] || continue
  co=$(wc -c < "${f}" | tr -d ' ')
  if [ "${co}" -gt 20480 ]; then echo "${f} ${co} B"; truot=1; fi
done
if [ "${truot}" = 1 ]; then echo 'KICH-THUOC: TRƯỢT'; exit 1; fi
echo 'KICH-THUOC: ĐẠT'
