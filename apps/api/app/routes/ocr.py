from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import tempfile
import os
import logging
from typing import Dict, Any

from app.services.shaken_ocr import extract_text_from_pdf_or_ocr, parse_shaken_text

router = APIRouter(prefix="/ocr", tags=["ocr"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/tiff",
}

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif"}


@router.post("/shaken")
async def ocr_shaken(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    車検証OCR API

    入力: PDF / PNG / JPG / WEBP

    出力:
        {
            "text": "...",
            "fields": {
                "maker": "...", "model": "...", "year": "...",
                "vin": "...", "model_code": "...", "car_number": "..."
            }
        }
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="ファイルがありません")

    # 拡張子チェック
    suffix = os.path.splitext(file.filename)[1].lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="対応していないファイル形式です（対応: PDF, JPG, PNG, WEBP）",
        )

    # Content-Type チェック
    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="対応していないファイル形式です（対応: PDF, JPG, PNG, WEBP）",
        )

    # ファイル読み込み
    contents = await file.read()

    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="ファイルが空です")

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="ファイルサイズが大きすぎます（最大20MB）",
        )

    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        # OCR / PDF 抽出
        text = extract_text_from_pdf_or_ocr(tmp_path)

        if not text or len(text.strip()) < 10:
            raise HTTPException(
                status_code=422,
                detail="文字を抽出できませんでした。鮮明な画像かPDFを使用してください。",
            )

        # フィールド抽出
        fields = parse_shaken_text(text)

        return JSONResponse(
            {
                "success": True,
                "text": text,
                "fields": fields,
            }
        )

    except HTTPException:
        raise

    except Exception:
        logging.exception("OCR処理失敗")
        # 内部エラーの詳細は外部に露出しない
        raise HTTPException(
            status_code=500,
            detail="OCR処理に失敗しました。再度お試しください。",
        )

    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
