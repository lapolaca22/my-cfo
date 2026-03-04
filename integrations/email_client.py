"""
Email Integration — placeholder implementation.

Replace method bodies with real calls to your email provider
(e.g. Microsoft Graph API for Outlook, Gmail API, IMAP).
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


class EmailError(Exception):
    pass


@dataclass
class EmailMessage:
    message_id: str
    sender: str
    subject: str
    body: str
    received_at: str
    attachments: list[dict] = field(default_factory=list)
    # Each attachment: {"filename": str, "content_type": str, "data": bytes}


class EmailClient:
    """Facade for email inbox monitoring used by the AP Agent."""

    def __init__(
        self,
        host: str,
        username: str,
        password: str,
        inbox_folder: str = "Invoices",
    ) -> None:
        self.host = host
        self.username = username
        self.password = password
        self.inbox_folder = inbox_folder
        logger.info("EmailClient initialised (inbox=%s)", inbox_folder)

    def fetch_unread_invoice_emails(self) -> list[EmailMessage]:
        """
        Retrieve unread emails from the designated invoice inbox folder.
        Returns a list of EmailMessage objects with attachments preloaded.
        """
        logger.info(
            "[EMAIL PLACEHOLDER] fetch_unread_invoice_emails from folder=%s",
            self.inbox_folder,
        )
        # TODO: connect via IMAP / Microsoft Graph and pull unread messages
        return []

    def mark_as_processed(self, message_id: str, label: str = "Processed") -> None:
        """
        Mark an email as processed (move to folder or add label)
        so it is not fetched again on the next run.
        """
        logger.info(
            "[EMAIL PLACEHOLDER] mark_as_processed: id=%s label=%s",
            message_id,
            label,
        )
        # TODO: IMAP STORE +FLAGS \\Seen or Graph API update

    def send_notification(
        self,
        to: str,
        subject: str,
        body: str,
        cc: Optional[list[str]] = None,
    ) -> None:
        """Send an email notification (e.g. approval requests, exception alerts)."""
        logger.info(
            "[EMAIL PLACEHOLDER] send_notification: to=%s subject=%s", to, subject
        )
        # TODO: SMTP send or Graph API sendMail
