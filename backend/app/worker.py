import hashlib
import json
from pathlib import Path

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Document, DocumentExtraction


def _classify_extension(name: str) -> str:
    ext = name.lower().split(".")[-1] if "." in name else ""
    if ext in {"pdf"}:
        return "contract"
    if ext in {"jpg", "jpeg", "png"}:
        return "photo"
    if ext in {"txt"}:
        return "text"
    return "other"


def _mock_extract_text(path: str) -> str:
    file_path = Path(path)
    if not file_path.exists():
        return "missing_file"
    data = file_path.read_bytes()
    digest = hashlib.sha1(data).hexdigest()[:12]
    return f"mock_text_sha1:{digest}"


def process_document_job(document_id: int) -> None:
    session = SessionLocal()
    try:
        doc = session.get(Document, document_id)
        if doc is None:
            return
        extras = dict(doc.extras or {})
        file_path = extras.get("path", "")
        name = extras.get("name", "")
        doc_type = _classify_extension(name)
        text = _mock_extract_text(file_path)

        extraction_payload = {
            "doc_type": doc_type,
            "text": text,
            "fields": {"summary": text[:32]},
        }
        extraction = DocumentExtraction(
            document_id=document_id,
            extras=json.loads(json.dumps(extraction_payload)),
        )
        session.add(extraction)
        session.flush()

        extras["status"] = "needs_review"
        extras["doc_type"] = doc_type
        extras["extraction_id"] = extraction.id
        doc.extras = extras
        session.commit()
    finally:
        session.close()


def run_worker() -> None:
    from redis import Redis
    from rq import Worker

    import os

    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    worker = Worker(["default"], connection=Redis.from_url(redis_url))
    worker.work()


if __name__ == "__main__":
    run_worker()
