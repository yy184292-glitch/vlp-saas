# app/services/shaken_ocr.py
from __future__ import annotations

import io
import os
import re
import tempfile
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from PIL import Image

# Optional deps (local OCR)
try:
    import pytesseract
except Exception:  # pragma: no cover
    pytesseract = None  # type: ignore

try:
    from pdf2image import convert_from_path
except Exception:  # pragma: no cover
    convert_from_path = None  # type: ignore

# Optional deps (Google Vision)
try:
    from google.cloud import vision  # type: ignore
except Exception:  # pragma: no cover
    vision = None  # type: ignore


class ShakenOcrError(RuntimeError):
    pass


@dataclass(frozen=True)
class OcrConfig:
    lang: str = "jpn"
    # 画像の前処理を簡易にON/OFF（必要なら拡張）
    preprocess: bool = True
    # Windows向け: 例 "C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
    tesseract_cmd: Optional[str] = None
    # OCR provider override（環境変数 OCR_PROVIDER が優先）
    # - "google": Google Vision
    # - "local": pytesseract
    # - "aws": 予約（Textract）/ まだ未実装
    provider: Optional[str] = None


def _get_provider(cfg: OcrConfig) -> str:
    p = (os.getenv("OCR_PROVIDER") or cfg.provider or "local").strip().lower()
    if p in ("google", "gcp", "vision"):
        return "google"
    if p in ("aws", "textract"):
        return "aws"
    return "local"


def _safe_ext(filename: str) -> str:
    _, ext = os.path.splitext(filename.lower())
    return ext


def _require_pdf_dep_if_needed(file_ext: str) -> None:
    if file_ext == ".pdf" and convert_from_path is None:
        raise ShakenOcrError("pdf2image not installed. Run: pip install pdf2image")


def _require_local_ocr() -> None:
    if pytesseract is None:
        raise ShakenOcrError("pytesseract not installed. Run: pip install pytesseract")


def _require_google_ocr() -> None:
    if vision is None:
        raise ShakenOcrError("google-cloud-vision not installed. Add to requirements.txt: google-cloud-vision")


def _load_images_from_bytes(filename: str, content: bytes) -> List[Image.Image]:
    ext = _safe_ext(filename)
    _require_pdf_dep_if_needed(ext)

    if ext in (".png", ".jpg", ".jpeg", ".webp"):
        try:
            return [Image.open(io.BytesIO(content)).convert("RGB")]
        except Exception as e:
            raise ShakenOcrError(f"Invalid image file: {e}") from e

    if ext == ".pdf":
        if convert_from_path is None:
            raise ShakenOcrError("pdf2image is required for pdf.")

        pdf_path: Optional[str] = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(content)
                pdf_path = f.name
            images = convert_from_path(pdf_path)  # type: ignore
            return [img.convert("RGB") for img in images]
        except Exception as e:
            raise ShakenOcrError(f"Failed to convert pdf: {e}") from e
        finally:
            if pdf_path:
                try:
                    os.remove(pdf_path)
                except Exception:
                    pass

    raise ShakenOcrError("Unsupported file type. Use png/jpg/webp/pdf.")


def _preprocess(img: Image.Image) -> Image.Image:
    # 最小限：グレースケール + ちょい拡大
    gray = img.convert("L")
    w, h = gray.size
    scale = 1.5
    resized = gray.resize((int(w * scale), int(h * scale)))
    return resized


def _pil_to_png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _ocr_local(images: List[Image.Image], cfg: OcrConfig) -> str:
    _require_local_ocr()

    if cfg.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = cfg.tesseract_cmd  # type: ignore
    elif os.getenv("TESSERACT_CMD"):
        pytesseract.pytesseract.tesseract_cmd = os.getenv("TESSERACT_CMD")  # type: ignore

    texts: List[str] = []
    for img in images:
        if cfg.preprocess:
            img = _preprocess(img)
        try:
            txt = pytesseract.image_to_string(img, lang=cfg.lang)  # type: ignore
        except Exception as e:
            raise ShakenOcrError(f"OCR failed (local): {e}") from e
        texts.append(txt)

    return "\n\n".join(texts)


def _ocr_google(images: List[Image.Image], cfg: OcrConfig) -> str:
    _require_google_ocr()

    try:
        client = vision.ImageAnnotatorClient()  # type: ignore
    except Exception as e:
        raise ShakenOcrError(f"Failed to init Google Vision client: {e}") from e

    texts: List[str] = []
    for img in images:
        if cfg.preprocess:
            img = _preprocess(img)

        b = _pil_to_png_bytes(img)
        image = vision.Image(content=b)  # type: ignore
        try:
            resp = client.text_detection(image=image)  # type: ignore
        except Exception as e:
            raise ShakenOcrError(f"OCR failed (google): {e}") from e

        if getattr(resp, "error", None) and getattr(resp.error, "message", ""):
            raise ShakenOcrError(f"OCR failed (google): {resp.error.message}")

        ann = getattr(resp, "full_text_annotation", None)
        if ann and getattr(ann, "text", None):
            texts.append(str(ann.text))
        else:
            tas = getattr(resp, "text_annotations", None) or []
            texts.append(str(tas[0].description) if tas else "")

    return "\n\n".join(texts)


def ocr_text_from_file_bytes(filename: str, content: bytes, cfg: OcrConfig = OcrConfig()) -> str:
    provider = _get_provider(cfg)

    images = _load_images_from_bytes(filename=filename, content=content)

    if provider == "google":
        return _ocr_google(images, cfg)

    if provider == "aws":
        raise ShakenOcrError("OCR_PROVIDER=aws is not enabled yet. Set OCR_PROVIDER=google for now.")

    return _ocr_local(images, cfg)


# -------------------------
# ここから「簡易パーサ」
# -------------------------

def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _find_first(patterns: List[str], text: str) -> Optional[str]:
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            return _norm(m.group(1))
    return None


def parse_shaken_text_to_json(text: str) -> Dict[str, Any]:
    """
    最小限の車検証OCRパース。

    - OCRエンジン（google/local）を差し替えても、ここは同じ入力（text）で動く。
    - より高精度化は「VisionのDocument OCR」「座標」「辞書」などを追加して拡張していく。
    """
    t = text

    # 車台番号
    vin = _find_first(
        [
            r"(?:車台番号|車台|VIN)\s*[:：\s]*([A-Z0-9\-]{6,20})",
        ],
        t,
    )

    # 登録番号
    plate = _find_first(
        [
            r"(?:登録番号|ナンバー)\s*[:：\s]*([^\n]{4,20})",
        ],
        t,
    )

    # 型式
    model_code = _find_first(
        [
            r"(?:型式)\s*[:：\s]*([A-Z0-9\-\_]{3,20})",
        ],
        t,
    )

    # 車検有効期限
    shaken_expire_date = _find_first(
        [
            r"(?:車検有効期限|有効期限)\s*[:：\s]*([0-9]{4}[\/\-\.\s][0-9]{1,2}[\/\-\.\s][0-9]{1,2})",
        ],
        t,
    )

    # 走行距離
    mileage = _find_first(
        [
            r"(?:走行距離)\s*[:：\s]*([0-9]{1,7})\s*(?:km|ＫＭ|Km|ｋｍ)?",
        ],
        t,
    )
    mileage_int: Optional[int] = None
    if mileage:
        try:
            mileage_int = int(re.sub(r"\D", "", mileage))
        except Exception:
            mileage_int = None

    return {
        "vin": vin,
        "plate": plate,
        "model_code": model_code,
        "shaken_expire_date": shaken_expire_date,
        "mileage": mileage_int,
        "raw_text": text,
    }
