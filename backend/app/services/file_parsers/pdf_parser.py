from pypdf import PdfReader
import io

from app.core.exceptions import AppError


def parse_pdf_bytes(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        pages = []
        for i, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            text = text.strip()
            if text:
                pages.append(f"[PAGE {i}]\n{text}")
        return "\n\n".join(pages)
    except AppError:
        raise
    except Exception as exc:
        raise AppError(
            400,
            "corrupt_file",
            "Unable to read this file — it may be corrupted or not a valid PDF.",
        ) from exc
