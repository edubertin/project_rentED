import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import re

from pydantic import BaseModel, Field


CONTRACT_FIELDS = [
    # Canonical rental contract fields (English).
    "real_estate_name",
    "landlord_address",
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

MS_IMOVEIS_FIELDS = [
    "contract_title",
    "document_platform",
    "document_code",
    "administrator_name",
    "administrator_creci",
    "administrator_address",
    "admin_fee_percent",
    "guarantee_provider_name",
    "guarantee_provider_cnpj",
    "guarantee_provider_address",
    "guarantee_annex_reference",
    "payment_method",
    "includes_condominium",
    "includes_iptu",
    "late_fee_percent",
    "interest_percent_month",
    "tolerance_rule",
    "breach_penalty_months",
    "forum_city",
    "forum_state",
    "signed_city",
    "signed_state",
]


def _suggested_fields_catalog() -> list[str]:
    catalog: list[str] = []
    for item in CONTRACT_FIELDS + MS_IMOVEIS_FIELDS:
        if item not in catalog:
            catalog.append(item)
    return catalog


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


def _model_prompt_context(real_estate_name: str | None) -> tuple[str, list[str]]:
    hint = ""
    if real_estate_name:
        hint = f"The real estate company is '{real_estate_name}'."
    return hint, _suggested_fields_catalog()


def run_llm_extraction(
    text: str,
    filename: str,
    real_estate_name: str | None = None,
    model_fields: list[str] | None = None,
    model_prompt: str | None = None,
) -> ExtractionResult:
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

    model_hint, default_fields = _model_prompt_context(real_estate_name)
    effective_fields = model_fields or default_fields
    if model_prompt:
        model_hint = f"{model_prompt} {model_hint}".strip()
    system_prompt = (
        "You are an extraction engine for property management documents. "
        "Return JSON with keys: doc_type, fields, summary, alerts, confidence. "
        "doc_type must be one of: contract, invoice, receipt, work_order, other. "
        "Extract common fields using these keys when available: "
        + ", ".join(effective_fields)
        + ". You may add additional snake_case field keys that appear in the document. "
        "Use null for unknown fields. "
        "Always try to extract rent_amount and admin_fee_percent if present. "
        "If the rent value appears in words (por extenso), convert it to a numeric BRL amount "
        "and still return a normalized currency string like 'R$ 3.100,00'. "
        "Contracts are in pt-BR, so assume BRL unless the document explicitly uses another currency. "
        "Use fields.sensitive_topics as a list of sensitive flags if found (e.g., "
        "ID numbers, bank details, payment methods, guarantor info). "
        "Keep summary <= 50 words and alerts <= 5 short strings. "
        "Always include a confidence score between 0 and 1. "
        + model_hint
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


def quick_extract_contract_fields(text: str) -> dict[str, Any]:
    if not text:
        return {}
    fields: dict[str, Any] = {}
    rent_match = re.search(
        r"aluguel[^\\n\\r]{0,80}(R\\$\\s*[\\d\\.]+,\\d{2})",
        text,
        flags=re.IGNORECASE,
    )
    if not rent_match:
        rent_match = re.search(r"(R\\$\\s*[\\d\\.]+,\\d{2})", text)
    if rent_match:
        fields["rent_amount"] = rent_match.group(1).strip()

    admin_match = re.search(
        r"admin[^\\n\\r]{0,80}(\\d{1,2}(?:[\\.,]\\d{1,2})?)\\s*%",
        text,
        flags=re.IGNORECASE,
    )
    if admin_match:
        fields["admin_fee_percent"] = admin_match.group(1).replace(",", ".").strip()
    return fields


def summarize_property(payload: dict[str, Any]) -> str:
    ai_mode = os.getenv("AI_MODE", "live").lower()
    if ai_mode == "mock":
        tag = payload.get("tag") or payload.get("label") or "Property"
        address = payload.get("property_address") or "address not provided"
        return f"{tag} located at {address}."

    from langchain_core.prompts import ChatPromptTemplate
    from langchain_openai import ChatOpenAI

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return ""

    model_name = os.getenv("OPENAI_MODEL", "gpt-4o")
    temperature = float(os.getenv("OPENAI_TEMPERATURE", "0"))
    max_tokens = int(os.getenv("OPENAI_MAX_TOKENS", "256"))

    system_prompt = (
        "You are summarizing a rental property record for an internal dashboard. "
        "Use only the provided data. Be concise (2-4 sentences). "
        "Mention tag/name, address, status (rented or not), "
        "rent values, bedrooms/bathrooms/parking if available, "
        "and any contract highlights (tenant/real estate) if present. "
        "Do not invent data."
    )
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("human", "Property data (JSON):\n{payload}"),
        ]
    )
    llm = ChatOpenAI(
        model=model_name,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=30,
        max_retries=2,
    )
    try:
        result = llm.invoke(prompt.format(payload=json.dumps(payload, ensure_ascii=False)))
        return (result.content or "").strip()
    except Exception:
        return ""
