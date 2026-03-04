"""
Central configuration for the CFO automation system.

All secrets and connection strings should be provided via environment variables.
Never hard-code credentials in this file.
"""

import os
from dataclasses import dataclass, field


def _require(key: str) -> str:
    """Return an env var value or raise if not set."""
    value = os.getenv(key)
    if not value:
        raise EnvironmentError(
            f"Required environment variable '{key}' is not set. "
            "Check your .env file or deployment secrets."
        )
    return value


def _optional(key: str, default: str = "") -> str:
    return os.getenv(key, default)


@dataclass
class ERPConfig:
    base_url: str = field(default_factory=lambda: _require("ERP_BASE_URL"))
    api_key: str = field(default_factory=lambda: _require("ERP_API_KEY"))
    company_id: str = field(default_factory=lambda: _require("ERP_COMPANY_ID"))


@dataclass
class BankConfig:
    base_url: str = field(default_factory=lambda: _require("BANK_BASE_URL"))
    client_id: str = field(default_factory=lambda: _require("BANK_CLIENT_ID"))
    client_secret: str = field(default_factory=lambda: _require("BANK_CLIENT_SECRET"))
    account_id: str = field(default_factory=lambda: _require("BANK_ACCOUNT_ID"))


@dataclass
class CRMConfig:
    base_url: str = field(default_factory=lambda: _require("CRM_BASE_URL"))
    api_key: str = field(default_factory=lambda: _require("CRM_API_KEY"))


@dataclass
class EmailConfig:
    host: str = field(default_factory=lambda: _require("EMAIL_HOST"))
    username: str = field(default_factory=lambda: _require("EMAIL_USERNAME"))
    password: str = field(default_factory=lambda: _require("EMAIL_PASSWORD"))
    invoice_inbox: str = field(
        default_factory=lambda: _optional("EMAIL_INVOICE_INBOX", "Invoices")
    )


@dataclass
class StorageConfig:
    base_path: str = field(
        default_factory=lambda: _optional("STORAGE_BASE_PATH", "/data/finance")
    )


@dataclass
class AgentConfig:
    # AP Agent
    ap_approver_emails: list[str] = field(
        default_factory=lambda: [
            e.strip()
            for e in _optional("AP_APPROVER_EMAILS", "cfo@company.com,coo@company.com").split(",")
            if e.strip()
        ]
    )
    # AR Agent
    ar_review_email: str = field(
        default_factory=lambda: _optional("AR_REVIEW_EMAIL", "finance@company.com")
    )
    # Reporting Agent
    report_recipients: list[str] = field(
        default_factory=lambda: [
            e.strip()
            for e in _optional("REPORT_RECIPIENTS", "cfo@company.com").split(",")
            if e.strip()
        ]
    )
    base_currency: str = field(
        default_factory=lambda: _optional("BASE_CURRENCY", "EUR")
    )


@dataclass
class AppConfig:
    erp: ERPConfig = field(default_factory=ERPConfig)
    bank: BankConfig = field(default_factory=BankConfig)
    crm: CRMConfig = field(default_factory=CRMConfig)
    email: EmailConfig = field(default_factory=EmailConfig)
    storage: StorageConfig = field(default_factory=StorageConfig)
    agents: AgentConfig = field(default_factory=AgentConfig)


def load_config() -> AppConfig:
    """
    Load and return the application configuration.
    Reads all values from environment variables.
    Raises EnvironmentError for any missing required variable.
    """
    return AppConfig()
