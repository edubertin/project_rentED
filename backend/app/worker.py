import json
import os
from datetime import datetime, timezone

from app.ai import extract_text, prepare_llm_input, run_llm_extraction
from app.db import SessionLocal
from app.models import ActivityLog, Document, DocumentExtraction


def _confidence_threshold() -> float:
    import os

    try:
        return float(os.getenv("AI_CONFIDENCE_THRESHOLD", "0.7"))
    except ValueError:
        return 0.7


def _log_event(session: SessionLocal, event: str, document_id: int, extras: dict) -> None:
    payload = {
        "event": event,
        "document_id": document_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **extras,
    }
    session.add(ActivityLog(user_id=None, extras=payload))


def process_document_job(document_id: int) -> None:
    session = SessionLocal()
    try:
        doc = session.get(Document, document_id)
        if doc is None:
            return
        extras = dict(doc.extras or {})
        file_path = extras.get("path", "")
        name = extras.get("name", "")
        _log_event(session, "document_processing_started", document_id, {})
        text_result = extract_text(file_path)
        llm_result = None
        if not text_result.text:
            text_result.meta["errors"].append("no_text_extracted")
        else:
            prepared_text, llm_meta = prepare_llm_input(text_result.text)
            try:
                llm_result = run_llm_extraction(prepared_text, name)
            except Exception as exc:
                error_name = type(exc).__name__
                text_result.meta["errors"].append(f"llm_failed:{error_name}")

        alerts: list[str] = []
        if text_result.meta.get("errors"):
            alerts.extend(text_result.meta["errors"])

        if llm_result is None:
            doc_type = "other"
            fields = {}
            summary = ""
            confidence = 0.0
            alerts.append("llm_failed")
        else:
            doc_type = llm_result.doc_type
            fields = llm_result.fields
            summary = llm_result.summary
            confidence = llm_result.confidence
            alerts.extend(llm_result.alerts or [])

        if confidence < _confidence_threshold():
            alerts.append("low_confidence")

        ai_meta = {
            "ai_mode": os.getenv("AI_MODE", "live"),
            "model": os.getenv("OPENAI_MODEL", "gpt-4o"),
            "file_name": name,
            **(llm_meta if text_result.text else {}),
        }
        extraction_payload = {
            "doc_type": doc_type,
            "text": text_result.text,
            "fields": fields,
            "summary": summary,
            "alerts": alerts,
            "confidence": confidence,
            "meta": {**text_result.meta, **ai_meta},
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
        extras["confidence"] = confidence
        extras["alerts"] = alerts
        doc.extras = extras
        _log_event(
            session,
            "document_processing_finished",
            document_id,
            {"status": "needs_review", "confidence": confidence},
        )
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
