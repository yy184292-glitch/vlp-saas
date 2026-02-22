from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.routes.cars import get_current_user, get_db
from app.services.shaken_ocr import (
    OcrConfig,
    ShakenOcrError,
    ocr_text_from_file_bytes,
    parse_shaken_text_to_json,
)

router = APIRouter(prefix="/shaken", tags=["shaken"])


@router.post("/parse", status_code=status.HTTP_200_OK)
async def parse_shaken(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    MAX_BYTES = 10 * 1024 * 1024
    content = await file.read()

    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    try:
        text = ocr_text_from_file_bytes(
            filename=file.filename or "upload",
            content=content,
            cfg=OcrConfig(lang="jpn", preprocess=True),
        )
        shaken = parse_shaken_text_to_json(text)
        return {"shaken": shaken}

    except ShakenOcrError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse shaken")
