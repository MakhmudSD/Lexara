from __future__ import annotations

from app.core.exceptions import AppError


def parse_txt_bytes(file_bytes: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise AppError(400, "unsupported_text_encoding", "Unable to decode the uploaded TXT file.")
