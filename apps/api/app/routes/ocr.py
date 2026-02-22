from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import tempfile
import shutil
import os
import logging
from typing import Dict, Any

# main.py から移植する関数（後で分離推奨）
from app.services.shaken_ocr import extract_text_from_pdf_or_ocr, parse_shaken_text

router = APIRouter(prefix="/ocr", tags=["ocr"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


@router.post("/shaken")
async def ocr_shaken(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    車検証OCR API

    入力:
        PDF / PNG / JPG

    出力:
        {
            "text": "...",
            "fields": {
                "maker": "...",
                "model": "...",
                "year": "...",
                "vin": "...",
                "model_code": "...",
            }
        }
    """

    if not file:
        raise HTTPException(status_code=400, detail="ファイルがありません")

    # サイズチェック
    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="ファイルサイズが大きすぎます（最大20MB）",
        )

    suffix = os.path.splitext(file.filename)[1].lower()

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        # OCR / PDF抽出
        text = extract_text_from_pdf_or_ocr(tmp_path)

        if not text or len(text.strip()) < 10:
            raise HTTPException(
                status_code=422,
                detail="文字を抽出できませんでした",
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

    except Exception as e:
        logging.exception("OCR失敗")
        raise HTTPException(
            status_code=500,
            detail=f"OCR処理エラー: {str(e)}",
        )

    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass