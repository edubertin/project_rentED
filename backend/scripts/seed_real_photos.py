import argparse
import random
import string
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
import shutil

from app.auth import hash_password
from app.db import SessionLocal
from app.models import Property, User, WorkOrder
from app.storage import get_upload_dir


PHOTO_SOURCES = [
    {
        "name": "cottage_house.jpg",
        "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Cottage_house.jpg",
    },
    {
        "name": "old_house_view_from_street.jpg",
        "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Old_house_view_from_street.jpg",
    },
    {
        "name": "basic_house.jpg",
        "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Basic_house.jpg",
    },
    {
        "name": "unidentified_house.jpg",
        "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Unidentified_house.jpg",
    },
    {
        "name": "american_house_type.jpg",
        "url": "https://commons.wikimedia.org/wiki/Special:FilePath/American_house_type.jpg",
    },
    {
        "name": "old_house.jpg",
        "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Old_house_(1).jpg",
    },
    {
        "name": "old_house_architecture_design.jpg",
        "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Old_house_architecture_design.jpg",
    },
    {
        "name": "white_house_green_hill.jpg",
        "url": "https://commons.wikimedia.org/wiki/Special:FilePath/White_house_on_top_of_green_hill_with_high_grass.jpg",
    },
    {
        "name": "nice_lake_house.jpg",
        "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Nice_lake_with_house_in_background.jpg",
    },
    {
        "name": "big_wooden_house.jpg",
        "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Big_nice_wooden_house.jpg",
    },
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

CITIES = ["Pirassununga", "Ribeirao Preto", "Campinas", "Sao Paulo"]
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


def _download_photos(seed_dir: Path) -> list[Path]:
    seed_dir.mkdir(parents=True, exist_ok=True)
    local_files = []
    for photo in PHOTO_SOURCES:
        target = seed_dir / photo["name"]
        if not target.exists():
            req = urllib.request.Request(
                photo["url"],
                headers={"User-Agent": "rentED-seed/1.0"},
            )
            with urllib.request.urlopen(req) as resp, open(target, "wb") as handle:
                handle.write(resp.read())
        local_files.append(target)
    return local_files


def _local_upload_photos(upload_dir: Path) -> list[Path]:
    if not upload_dir.exists():
        return []
    images = []
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp"):
        images.extend(upload_dir.glob(ext))
    return images


def _assign_photo(upload_dir: Path, source: Path, tag: str) -> dict:
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"seed_real_{tag.lower().replace(' ', '_')}_{_rand_digits(4)}{source.suffix}"
    target = upload_dir / filename
    shutil.copyfile(source, target)
    return {
        "name": filename,
        "path": str(target),
        "url": f"/uploads/{filename}",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }


def seed_real_photos(count: int, seed_admin: bool) -> None:
    session = SessionLocal()
    try:
        admin_id = None
        existing_admin = session.query(User).filter(User.username == "admin").one_or_none()
        if existing_admin:
            admin_id = existing_admin.id
        if seed_admin and not existing_admin:
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

        upload_dir = get_upload_dir()
        local_photos = _local_upload_photos(upload_dir)
        if not local_photos:
            seed_dir = Path("data/seed_photos")
            local_photos = _download_photos(seed_dir)

        work_order_titles = [
            "Plumbing inspection",
            "Electrical check",
            "Garden cleanup",
            "Air conditioning service",
            "Roof maintenance",
            "Paint touch-up",
            "Pool cleaning",
            "Security camera setup",
        ]
        for idx in range(count):
            username = _username("owner", idx + 1)
            owner = User(
                username=username,
                password_hash=hash_password("Test123!"),
                role="property_owner",
                name=f"Owner {idx + 1}",
                cell_number=_phone(),
                email=_email(username),
                cpf=_cpf(),
                extras={},
            )
            session.add(owner)
            session.flush()

            tag = PROPERTY_TAGS[idx % len(PROPERTY_TAGS)]
            address = f"{random.choice(STREETS)}, {random.randint(10, 999)} - {random.choice(CITIES)}/{random.choice(STATES)}"
            is_rented = random.choice([True, False])
            rent_value = random.randint(1200, 4500) * 100
            desired_value = random.randint(1500, 4000) * 100
            photo = _assign_photo(upload_dir, local_photos[idx % len(local_photos)], tag)

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
                "photos": [photo],
            }
            if is_rented:
                extras.update(
                    {
                        "real_estate_name": "MS Imoveis",
                        "tenant_name": f"Tenant {owner.id}-{idx + 1}",
                        "admin_fee_percent": "10",
                        "contract_number": f"CT-{owner.id}-{idx + 1}",
                    }
                )

            prop = Property(owner_user_id=owner.id, extras=extras)
            session.add(prop)
            session.flush()

            wo_type = random.choice(["quote", "fixed"])
            session.add(
                WorkOrder(
                    property_id=prop.id,
                    type=wo_type,
                    status="quote_requested" if wo_type == "quote" else "offer_open",
                    title=random.choice(work_order_titles),
                    description="Seeded work order for layout testing.",
                    offer_amount=round(random.uniform(200, 1800), 2) if wo_type == "fixed" else None,
                    approved_amount=None,
                    assigned_interest_id=None,
                    created_by_user_id=admin_id or owner.id,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                    extras={
                        "property_tag": tag,
                        "seed": True,
                    },
                )
            )

        session.commit()
        print(f"Seeded {count} properties with real photos and work orders.")
    finally:
        session.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed properties with real public-domain photos.")
    parser.add_argument("--properties", type=int, default=10)
    parser.add_argument("--seed-admin", action="store_true")
    args = parser.parse_args()
    seed_real_photos(args.properties, args.seed_admin)


if __name__ == "__main__":
    main()
