import os
from pathlib import Path


def get_upload_dir() -> Path:
    base = Path(os.getenv("UPLOAD_DIR", "/app/data/uploads"))
    base.mkdir(parents=True, exist_ok=True)
    return base
