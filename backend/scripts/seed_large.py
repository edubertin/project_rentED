import argparse
import random
import string
from datetime import datetime, timezone
from pathlib import Path

from app.auth import hash_password
from app.db import SessionLocal
from app.models import Document, Property, User, WorkOrder
from app.storage import get_upload_dir


ROLE_POOL = [
    "property_owner",
    "real_estate",
    "finance",
    "service_provider",
]

PROPERTY_TAGS = [
    "Casa Jardim",
    "Residencial Solar",
    "Vista Verde",
    "Condominio Lago",
    "Parque Central",
    "Alameda Norte",
    "Residencial Azul",
    "Vila Aurora",
    "Casa Prime",
    "Jardins do Sul",
]

STREETS = [
    "Rua Arthur Del Nero",
    "Rua Germano Dix",
    "Alameda dos Caipos",
    "Av. Central",
    "Rua das Flores",
    "Rua do Sol",
    "Rua das Palmeiras",
    "Rua XV de Novembro",
    "Rua Rio Branco",
    "Av. Brasil",
]

CITIES = [
    "Pirassununga",
    "Ribeirao Preto",
    "Campinas",
    "Sao Paulo",
]

STATES = ["SP", "MG", "PR"]


def _rand_digits(count: int) -> str:
    return "".join(random.choice(string.digits) for _ in range(count))


def _phone() -> str:
    return f"({_rand_digits(3)}) {_rand_digits(5)} {_rand_digits(4)}"


def _cpf() -> str:
    return _rand_digits(11)


def _email(username: str) -> str:
    return f"{username}@example.com"


def _username(prefix: str, idx: int) -> str:
    return f"{prefix}{idx}{_rand_digits(2)}"


def _create_svg(path: Path, label: str) -> None:
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1f2937" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#g)" />
  <rect x="80" y="80" width="1040" height="640" rx="32" fill="#111827" stroke="#334155" stroke-width="4" />
  <text x="120" y="180" fill="#e2e8f0" font-size="48" font-family="Inter, sans-serif">{label}</text>
  <text x="120" y="240" fill="#94a3b8" font-size="28" font-family="Inter, sans-serif">Sample property photo</text>
</svg>
"""
    path.write_text(svg, encoding="utf-8")


def _create_photo_items(count: int, tag: str) -> list[dict]:
    upload_dir = get_upload_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)
    photos = []
    for idx in range(count):
        filename = f"seed_{tag.lower().replace(' ', '_')}_{idx + 1}_{_rand_digits(4)}.svg"
        file_path = upload_dir / filename
        _create_svg(file_path, tag)
        photos.append(
            {
                "name": filename,
                "path": str(file_path),
                "url": f"/uploads/{filename}",
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    return photos


def _create_document(property_id: int, tag: str) -> Document:
    upload_dir = get_upload_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{tag.lower().replace(' ', '_')}_contract_{_rand_digits(4)}.txt"
    file_path = upload_dir / filename
    file_path.write_text("Sample contract file for testing.", encoding="utf-8")
    return Document(
        property_id=property_id,
        extras={"path": str(file_path), "status": "uploaded", "name": filename},
    )


def seed_large(user_count: int, properties_per_owner: int, seed_admin: bool) -> None:
    session = SessionLocal()
    try:
        owners: list[User] = []
        admin_id = None
        existing_admin = (
            session.query(User).filter(User.username == "admin").one_or_none()
        )
        if existing_admin:
            admin_id = existing_admin.id
        if seed_admin:
            if not existing_admin:
                admin = User(
                    username="admin",
                    password_hash=hash_password("Admin123!"),
                    role="admin",
                    name="Admin User",
                    cell_number=_phone(),
                    email=_email("admin"),
                    cpf=_cpf(),
                    extras={},
                )
                session.add(admin)
                session.flush()
                admin_id = admin.id

        for idx in range(user_count):
            role = ROLE_POOL[idx % len(ROLE_POOL)]
            username = _username(role.replace("_", ""), idx + 1)
            user = User(
                username=username,
                password_hash=hash_password("Test123!"),
                role=role,
                name=f"{role.replace('_', ' ').title()} {idx + 1}",
                cell_number=_phone(),
                email=_email(username),
                cpf=_cpf(),
                extras={},
            )
            session.add(user)
            if role == "property_owner":
                owners.append(user)

        session.flush()

        for owner in owners:
            for p_idx in range(properties_per_owner):
                tag = random.choice(PROPERTY_TAGS)
                address = f"{random.choice(STREETS)}, {random.randint(10, 999)} - {random.choice(CITIES)}/{random.choice(STATES)}"
                is_rented = random.choice([True, False])
                rent_value = random.randint(1200, 4500) * 100
                desired_value = random.randint(1500, 4000) * 100
                photos = _create_photo_items(random.randint(1, 3), tag)
                extras = {
                    "tag": tag,
                    "property_address": address,
                    "bedrooms": random.randint(1, 4),
                    "bathrooms": random.randint(1, 3),
                    "parking_spaces": random.randint(0, 3),
                    "is_rented": is_rented,
                    "rent_currency": "BRL",
                    "desired_rent_value": 0 if is_rented else desired_value,
                    "desired_rent_display": "" if is_rented else f"R$ {desired_value / 100:.2f}",
                    "current_rent_value": rent_value if is_rented else 0,
                    "current_rent_display": f"R$ {rent_value / 100:.2f}" if is_rented else "",
                    "rent_amount_value": rent_value if is_rented else desired_value,
                    "rent_amount_display": f"R$ {(rent_value if is_rented else desired_value) / 100:.2f}",
                    "owner_name": owner.name,
                    "owner_contact": {
                        "email": owner.email,
                        "cpf": owner.cpf,
                        "cell_number": owner.cell_number,
                    },
                    "photos": photos,
                }
                if is_rented:
                    extras.update(
                        {
                            "real_estate_name": "MS Imoveis",
                            "tenant_name": f"Tenant {owner.id}-{p_idx + 1}",
                            "admin_fee_percent": "10",
                            "contract_number": f"CT-{owner.id}-{p_idx + 1}",
                        }
                    )

                prop = Property(owner_user_id=owner.id, extras=extras)
                session.add(prop)
                session.flush()

                if is_rented:
                    session.add(_create_document(prop.id, tag))

                if random.choice([True, False]):
                    creator_id = admin_id or owner.id
                    wo_type = random.choice(["quote", "fixed"])
                    session.add(
                        WorkOrder(
                            property_id=prop.id,
                            type=wo_type,
                            status="quote_requested" if wo_type == "quote" else "offer_open",
                            title="General maintenance",
                            description="Routine inspection and fixes.",
                            offer_amount=round(random.uniform(300, 1200), 2) if wo_type == "fixed" else None,
                            approved_amount=None,
                            assigned_interest_id=None,
                            created_by_user_id=creator_id,
                            created_at=datetime.now(timezone.utc),
                            updated_at=datetime.now(timezone.utc),
                            extras={},
                        )
                    )

        session.commit()
        print(
            f"Seeded {user_count} users ({len(owners)} owners), "
            f"{len(owners) * properties_per_owner} properties."
        )
    finally:
        session.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed large demo dataset.")
    parser.add_argument("--users", type=int, default=12)
    parser.add_argument("--properties", type=int, default=3)
    parser.add_argument("--seed-admin", action="store_true")
    args = parser.parse_args()
    seed_large(args.users, args.properties, args.seed_admin)


if __name__ == "__main__":
    main()
