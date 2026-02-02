import os

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Property, User


ADMIN_ROLE = "admin"


def seed() -> None:
    session = SessionLocal()
    try:
        admin = session.execute(
            select(User).where(User.role == ADMIN_ROLE)
        ).scalar_one_or_none()
        if admin is None:
            admin = User(role=ADMIN_ROLE, extras={"name": "Admin"})
            session.add(admin)
            session.flush()

        existing_props = session.execute(
            select(Property).where(Property.owner_user_id == admin.id)
        ).scalars().all()
        if not existing_props:
            session.add_all(
                [
                    Property(owner_user_id=admin.id, extras={"label": "Imovel 1"}),
                    Property(owner_user_id=admin.id, extras={"label": "Imovel 2"}),
                ]
            )

        session.commit()
    finally:
        session.close()


if __name__ == "__main__":
    os.environ.setdefault(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@db:5432/app",
    )
    seed()
    print("Seed concluido")
