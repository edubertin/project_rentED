import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field


CONTRACT_FIELDS = [
    # Canonical rental contract fields (English).
    "landlord_name",
    "tenant_name",
    "landlord_cpf",
    "tenant_cpf",
    "landlord_rg",
    "tenant_rg",
    "tenant_address",
    "guarantor_name",
    "guarantor_cpf",
    "guarantor_rg",
    "security_deposit_amount",
    "security_deposit_type",  # deposit, cheques, guarantor
    "agency_fee_amount",
    "agency_fee_type",  # percentage or fixed
    "rent_amount",
    "payment_day",
    "property_address",
    "start_date",
    "end_date",
    "term_months",
    "early_termination_fee",
    "late_fee",
    "indexation_type",
    "indexation_rate",
    "sign_date",
    "contract_number",
    "document_numbers",
    "witnesses",
    "notes",
    "sensitive_topics",  # list of sensitive flags for audit/logs
]


class ExtractionResult(BaseModel):
    doc_type: str = Field(
        description="Document type. Use: contract, invoice, receipt, work_order, other."
    )
    fields: dict[str, Any] = Field(description="Extracted key/value fields.")
    summary: str = Field(description="Short summary of the document.")
    alerts: list[str] = Field(description="Warnings or review notes.")
    confidence: float = Field(ge=0, le=1, description="Confidence score 0-1.")


@dataclass
class TextExtraction:
    text: str
    meta: dict[str, Any]


def _max_text_chars() -> int:
    return int(os.getenv("AI_TEXT_MAX_CHARS", "100000"))


def _truncate_text(text: str) -> tuple[str, bool]:
    max_chars = _max_text_chars()
    if len(text) <= max_chars:
        return text, False
    return text[:max_chars], True


def _llm_input_max_chars() -> int:
    return int(os.getenv("AI_LLM_INPUT_MAX_CHARS", "12000"))


def prepare_llm_input(text: str) -> tuple[str, dict[str, Any]]:
    max_chars = _llm_input_max_chars()
    if len(text) <= max_chars:
        return text, {
            "llm_input_truncated": False,
            "llm_input_chars": len(text),
            "llm_input_max_chars": max_chars,
        }
    head_len = int(max_chars * 0.7)
    tail_len = max_chars - head_len
    head = text[:head_len]
    tail = text[-tail_len:] if tail_len > 0 else ""
    prepared = f"{head}\n\n...[TRUNCATED]...\n\n{tail}"
    return prepared, {
        "llm_input_truncated": True,
        "llm_input_chars": len(prepared),
        "llm_input_max_chars": max_chars,
    }


def extract_text(file_path: str) -> TextExtraction:
    meta: dict[str, Any] = {"errors": [], "source": None, "truncated": False}
    path = Path(file_path)
    if not path.exists():
        meta["errors"].append("missing_file")
        return TextExtraction(text="", meta=meta)

    suffix = path.suffix.lower()
    try:
        if suffix in {".txt", ".md", ".log", ".csv"}:
            raw = path.read_text(encoding="utf-8", errors="ignore")
            text, truncated = _truncate_text(raw)
            meta.update({"source": "text", "truncated": truncated})
            return TextExtraction(text=text, meta=meta)
        if suffix == ".pdf":
            from pypdf import PdfReader

            reader = PdfReader(str(path))
            chunks: list[str] = []
            for page in reader.pages:
                page_text = page.extract_text() or ""
                if page_text:
                    chunks.append(page_text)
            raw = "\n".join(chunks)
            text, truncated = _truncate_text(raw)
            meta.update({"source": "pdf", "truncated": truncated})
            if not text:
                meta["errors"].append("empty_pdf_text")
            return TextExtraction(text=text, meta=meta)
        if suffix in {".png", ".jpg", ".jpeg", ".tiff", ".bmp"}:
            ocr_mode = os.getenv("OCR_MODE", "none").lower()
            if ocr_mode != "tesseract":
                meta["errors"].append("ocr_disabled")
                return TextExtraction(text="", meta=meta)
            try:
                from PIL import Image
                import pytesseract
            except Exception:
                meta["errors"].append("ocr_dependencies_missing")
                return TextExtraction(text="", meta=meta)
            image = Image.open(str(path))
            raw = pytesseract.image_to_string(image)
            text, truncated = _truncate_text(raw)
            meta.update({"source": "tesseract", "truncated": truncated})
            if not text:
                meta["errors"].append("empty_ocr_text")
            return TextExtraction(text=text, meta=meta)
    except Exception as exc:
        meta["errors"].append(f"extract_failed:{type(exc).__name__}")
        return TextExtraction(text="", meta=meta)

    meta["errors"].append("unsupported_file_type")
    return TextExtraction(text="", meta=meta)


def _default_mock_result(text: str, filename: str) -> ExtractionResult:
    lower_name = (filename or "").lower()
    doc_type = "other"
    if lower_name.endswith(".pdf"):
        doc_type = "contract"
    if "invoice" in lower_name:
        doc_type = "invoice"
    summary = text[:120] if text else "no_text"
    alerts = []
    if not text:
        alerts.append("no_text_extracted")
    return ExtractionResult(
        doc_type=doc_type,
        fields={"summary": summary},
        summary=summary,
        alerts=alerts,
        confidence=0.55,
    )


def run_llm_extraction(text: str, filename: str) -> ExtractionResult:
    ai_mode = os.getenv("AI_MODE", "live").lower()
    if ai_mode == "mock":
        return _default_mock_result(text, filename)

    from langchain_core.prompts import ChatPromptTemplate
    from langchain_openai import ChatOpenAI

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    model_name = os.getenv("OPENAI_MODEL", "gpt-4o")
    temperature = float(os.getenv("OPENAI_TEMPERATURE", "0"))
    max_tokens = int(os.getenv("OPENAI_MAX_TOKENS", "512"))

    system_prompt = (
        "You are an extraction engine for property management documents. "
        "Return JSON with keys: doc_type, fields, summary, alerts, confidence. "
        "doc_type must be one of: contract, invoice, receipt, work_order, other. "
        "If the document is a contract, extract common fields using these keys: "
        + ", ".join(CONTRACT_FIELDS)
        + ". Use null for unknown fields. "
        "Use fields.sensitive_topics as a list of sensitive flags if found (e.g., "
        "ID numbers, bank details, payment methods, guarantor info). "
        "Keep summary <= 50 words and alerts <= 5 short strings. "
        "Always include a confidence score between 0 and 1."
    )
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("human", "Filename: {filename}\n\nText:\n{text}"),
        ]
    )

    llm = ChatOpenAI(
        model=model_name,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=30,
        max_retries=2,
    )
    structured_llm = llm.with_structured_output(ExtractionResult, method="json_mode")
    try:
        return structured_llm.invoke(prompt.format(filename=filename, text=text))
    except Exception:
        fallback_prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "Return a valid JSON object only. Do not include markdown or extra text. "
                    "Keep summary <= 50 words and alerts <= 5 short strings.",
                ),
                ("human", "Filename: {filename}\n\nText:\n{text}"),
            ]
        )
        raw = llm.invoke(
            fallback_prompt.format(filename=filename, text=text),
            response_format={"type": "json_object"},
        )
        payload = json.loads(raw.content)
        return ExtractionResult.model_validate(payload)
