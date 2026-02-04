import os

from sqlalchemy import select

from app.auth import hash_password
from app.db import SessionLocal
from app.models import Property, User


ADMIN_ROLE = "admin"
ADMIN_USERNAME = os.getenv("SEED_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD", "Admin123!")
ADMIN_NAME = os.getenv("SEED_ADMIN_NAME", "Admin User")
ADMIN_CELL = os.getenv("SEED_ADMIN_CELL", "(000) 00000 0000")
ADMIN_EMAIL = os.getenv("SEED_ADMIN_EMAIL", "admin@rented.local")
ADMIN_CPF = os.getenv("SEED_ADMIN_CPF", "000.000.000-00")


def seed() -> None:
    session = SessionLocal()
    try:
        admin = session.execute(
            select(User).where(User.role == ADMIN_ROLE).order_by(User.id.asc())
        ).scalars().first()
        if admin is None:
            admin = User(
                username=ADMIN_USERNAME,
                password_hash=hash_password(ADMIN_PASSWORD),
                role=ADMIN_ROLE,
                name=ADMIN_NAME,
                cell_number=ADMIN_CELL,
                email=ADMIN_EMAIL,
                cpf=ADMIN_CPF,
                extras={"name": ADMIN_NAME},
            )
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
