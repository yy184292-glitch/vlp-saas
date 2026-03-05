from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.models.user import User
from app.dependencies.auth import get_current_user
from app.db.session import get_db
from app.core.security import get_password_hash, verify_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user),
):
    """ログインユーザー情報（UIの権限制御で使用）"""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "name": current_user.name,
        "store_id": str(current_user.store_id) if current_user.store_id else None,
        "role": getattr(current_user, "role", "staff") or "staff",
    }


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("新しいパスワードは8文字以上で入力してください")
        return v


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def change_password(
    body: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """ログインユーザーのパスワード変更"""
    if not verify_password(body.current_password, current_user.password_hash or ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="現在のパスワードが正しくありません",
        )
    current_user.password_hash = get_password_hash(body.new_password)
    db.commit()
