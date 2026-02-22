# app/services/shaken_ocr.py
from __future__ import annotations

import os
import re
import tempfile
from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image

# Optional deps
try:
    import pytesseract
except Exception:  # pragma: no cover
    pytesseract = None  # type: ignore

try:
    from pdf2image import convert_from_path
except Exception:  # pragma: no cover
    convert_from_path = None  # type: ignore


class ShakenOcrError(RuntimeError):
    pass


@dataclass(frozen=True)
class OcrConfig:
    lang: str = "jpn"
    # 画像の前処理を簡易にON/OFF（必要なら拡張）
    preprocess: bool = True
    # Windows向け: 例 "C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
    tesseract_cmd: Optional[str] = None


def _require_deps(file_ext: str) -> None:
    if pytesseract is None:
        raise ShakenOcrError(
            "pytesseract not installed. Run: pip install pytesseract"
        )
    if file_ext == ".pdf" and convert_from_path is None:
        raise ShakenOcrError(
            "pdf2image not installed. Run: pip install pdf2image"
        )


def _safe_ext(filename: str) -> str:
    _, ext = os.path.splitext(filename.lower())
    return ext


def _load_images_from_bytes(
    filename: str,
    content: bytes,
) -> List[Image.Image]:
    ext = _safe_ext(filename)

    if ext in (".png", ".jpg", ".jpeg", ".webp"):
        try:
            return [Image.open(io.BytesIO(content)).convert("RGB")]  # type: ignore
        except Exception as e:
            raise ShakenOcrError(f"Invalid image file: {e}") from e

    if ext == ".pdf":
        if convert_from_path is None:
            raise ShakenOcrError("pdf2image is required for pdf.")
        # pdf2image はファイルパスが必要なので一時保存
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(content)
                pdf_path = f.name
            images = convert_from_path(pdf_path)  # type: ignore
            return [img.convert("RGB") for img in images]
        except Exception as e:
            raise ShakenOcrError(f"Failed to convert pdf: {e}") from e
        finally:
            try:
                os.remove(pdf_path)  # type: ignore
            except Exception:
                pass

    raise ShakenOcrError("Unsupported file type. Use png/jpg/webp/pdf.")


def _preprocess(img: Image.Image) -> Image.Image:
    # ここは最小限：グレースケール + ちょい拡大
    gray = img.convert("L")
    w, h = gray.size
    scale = 1.5
    resized = gray.resize((int(w * scale), int(h * scale)))
    return resized


def ocr_text_from_file_bytes(
    filename: str,
    content: bytes,
    cfg: OcrConfig = OcrConfig(),
) -> str:
    ext = _safe_ext(filename)
    _require_deps(ext)

    if cfg.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = cfg.tesseract_cmd  # type: ignore
    elif os.getenv("TESSERACT_CMD"):
        pytesseract.pytesseract.tesseract_cmd = os.getenv("TESSERACT_CMD")  # type: ignore

    # io は画像読み込みに必要
    import io  # local import to keep module light

    images: List[Image.Image] = []
    if ext in (".png", ".jpg", ".jpeg", ".webp"):
        try:
            images = [Image.open(io.BytesIO(content)).convert("RGB")]
        except Exception as e:
            raise ShakenOcrError(f"Invalid image file: {e}") from e
    elif ext == ".pdf":
        if convert_from_path is None:
            raise ShakenOcrError("pdf2image is required for pdf.")
        pdf_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(content)
                pdf_path = f.name
            images = convert_from_path(pdf_path)  # type: ignore
            images = [img.convert("RGB") for img in images]
        except Exception as e:
            raise ShakenOcrError(f"Failed to convert pdf: {e}") from e
        finally:
            if pdf_path:
                try:
                    os.remove(pdf_path)
                except Exception:
                    pass
    else:
        raise ShakenOcrError("Unsupported file type. Use png/jpg/webp/pdf.")

    texts: List[str] = []
    for img in images:
        if cfg.preprocess:
            img = _preprocess(img)
        try:
            txt = pytesseract.image_to_string(img, lang=cfg.lang)  # type: ignore
        except Exception as e:
            raise ShakenOcrError(f"OCR failed: {e}") from e
        texts.append(txt)

    return "\n\n".join(texts)


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
    最初は「それっぽく拾う」簡易版。
    将来、正規表現を強化 or 外部OCRのJSONをそのまま返す方式へ差し替え可能。
    """
    t = text

    # 車台番号: アルファ/数字/ハイフンが多い
    vin = _find_first(
        [
            r"(?:車台番号|車台番|VIN)\s*[:：]?\s*([A-Z0-9\-]{6,20})",
        ],
        t,
    )

    # 登録番号: 地名+数字+ひらがな+数字 のようなパターン（完全一致は難しいので緩め）
    plate = _find_first(
        [
            r"(?:登録番号|ナンバー)\s*[:：]?\s*([^\n]{4,20})",
        ],
        t,
    )

    # 型式
    model_code = _find_first(
        [
            r"(?:型式)\s*[:：]?\s*([A-Z0-9\-\_]{3,20})",
        ],
        t,
    )

    # 有効期間満了日（YYYY-MM-DD / YYYY/MM/DD / 令和等は後で拡張）
    shaken_expire_date = _find_first(
        [
            r"(?:有効期間満了日|満了日)\s*[:：]?\s*([0-9]{4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,2})",
        ],
        t,
    )

    # 走行距離（km）
    mileage = _find_first(
        [
            r"(?:走行距離)\s*[:：]?\s*([0-9]{1,7})\s*(?:km|ＫＭ|ｋｍ)?",
        ],
        t,
    )
    mileage_int: Optional[int] = None
    if mileage:
        try:
            mileage_int = int(re.sub(r"\D", "", mileage))
        except Exception:
            mileage_int = None

    result: Dict[str, Any] = {
        # cars/from-shaken 側のマッピングで拾えるように、日本語キーも同梱
        "車台番号": vin,
        "登録番号": plate,
        "型式": model_code,
        "有効期間満了日": shaken_expire_date,
        "走行距離": mileage_int,
        # 元テキストも入れる（デバッグや再パース用）
        "_raw_text": text,
    }

    # None を落とす
    return {k: v for k, v in result.items() if v is not None}
