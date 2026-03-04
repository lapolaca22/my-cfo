"""
CRM Integration — placeholder implementation.

Replace method bodies with real calls to your CRM
(e.g. Salesforce, HubSpot, Pipedrive, Zoho CRM).
"""

import logging
from typing import Any, Optional

from models import Invoice

logger = logging.getLogger(__name__)


class CRMError(Exception):
    pass


class CRMClient:
    """Facade for CRM operations used by the AR & Reconciliation Agent."""

    def __init__(self, base_url: str, api_key: str) -> None:
        self.base_url = base_url
        self.api_key = api_key
        logger.info("CRMClient initialised")

    def get_new_sales_invoices(self, since_timestamp: Optional[str] = None) -> list[Invoice]:
        """
        Fetch newly issued sales invoices from the CRM that have not yet
        been pushed to the ERP.
        ``since_timestamp`` is an ISO-8601 datetime string used as a cursor.
        """
        logger.info(
            "[CRM PLACEHOLDER] get_new_sales_invoices: since=%s", since_timestamp
        )
        # TODO: GET /invoices?status=new&created_after={since_timestamp}
        return []

    def mark_invoice_synced_to_erp(self, crm_invoice_id: str, erp_id: str) -> None:
        """
        Mark a CRM invoice as synced once it has been pushed to the ERP,
        to prevent duplicate processing on the next poll.
        """
        logger.info(
            "[CRM PLACEHOLDER] mark_invoice_synced_to_erp: crm=%s erp=%s",
            crm_invoice_id,
            erp_id,
        )
        # TODO: PATCH /invoices/{crm_invoice_id} {"erp_id": erp_id, "synced": true}

    def get_customer_info(self, customer_id: str) -> dict[str, Any]:
        """Return enriched customer data for matching / reporting purposes."""
        logger.info("[CRM PLACEHOLDER] get_customer_info: id=%s", customer_id)
        # TODO: GET /customers/{customer_id}
        return {"id": customer_id, "name": "Unknown", "payment_terms": 30}
