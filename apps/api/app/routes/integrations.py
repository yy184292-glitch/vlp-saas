from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.dependencies.request_user import attach_current_user, get_current_user
from app.models.store_setting import StoreSettingORM

router = APIRouter(
    prefix="/integrations",
    tags=["integrations"],
    dependencies=[Depends(attach_current_user)],
)


class IntegrationSettings(BaseModel):
    loan_enabled: bool = False
    loan_url: Optional[str] = None
    loan_company_name: Optional[str] = None
    warranty_enabled: bool = False
    warranty_url: Optional[str] = None
    warranty_company_name: Optional[str] = None
    insurance_enabled: bool = False
    insurance_url: Optional[str] = None
    insurance_company_name: Optional[str] = None


@router.get("", response_model=IntegrationSettings)
def get_integrations(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> IntegrationSettings:
    """自店舗のローン/保証/保険統合設定を取得。"""
    if not current_user.store_id:
        raise HTTPException(status_code=403, detail="店舗に所属していません")

    setting = db.execute(
        select(StoreSettingORM).where(StoreSettingORM.store_id == current_user.store_id)
    ).scalar_one_or_none()

    if not setting:
        return IntegrationSettings()

    return IntegrationSettings(
        loan_enabled=setting.loan_enabled or False,
        loan_url=setting.loan_url,
        loan_company_name=setting.loan_company_name,
        warranty_enabled=setting.warranty_enabled or False,
        warranty_url=setting.warranty_url,
        warranty_company_name=setting.warranty_company_name,
        insurance_enabled=setting.insurance_enabled or False,
        insurance_url=setting.insurance_url,
        insurance_company_name=setting.insurance_company_name,
    )


@router.put("", response_model=IntegrationSettings)
def update_integrations(
    body: IntegrationSettings,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> IntegrationSettings:
    """自店舗のローン/保証/保険統合設定を更新。なければ作成。"""
    if not current_user.store_id:
        raise HTTPException(status_code=403, detail="店舗に所属していません")
    if current_user.role not in ("admin", "manager", "superadmin"):
        raise HTTPException(status_code=403, detail="管理者権限が必要です")

    setting = db.execute(
        select(StoreSettingORM).where(StoreSettingORM.store_id == current_user.store_id)
    ).scalar_one_or_none()

    if not setting:
        setting = StoreSettingORM(store_id=current_user.store_id)
        db.add(setting)

    setting.loan_enabled = body.loan_enabled
    setting.loan_url = body.loan_url
    setting.loan_company_name = body.loan_company_name
    setting.warranty_enabled = body.warranty_enabled
    setting.warranty_url = body.warranty_url
    setting.warranty_company_name = body.warranty_company_name
    setting.insurance_enabled = body.insurance_enabled
    setting.insurance_url = body.insurance_url
    setting.insurance_company_name = body.insurance_company_name
    setting.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(setting)
    return IntegrationSettings(
        loan_enabled=setting.loan_enabled or False,
        loan_url=setting.loan_url,
        loan_company_name=setting.loan_company_name,
        warranty_enabled=setting.warranty_enabled or False,
        warranty_url=setting.warranty_url,
        warranty_company_name=setting.warranty_company_name,
        insurance_enabled=setting.insurance_enabled or False,
        insurance_url=setting.insurance_url,
        insurance_company_name=setting.insurance_company_name,
    )
