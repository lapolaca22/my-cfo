"""
Bank Integration — placeholder implementation.

Replace method bodies with real calls to your bank's API or
a PSD2/open-banking aggregator (e.g. Salt Edge, Plaid, TrueLayer, Finapi).
"""

import logging
from datetime import date
from typing import Any

from models import Payment

logger = logging.getLogger(__name__)


class BankError(Exception):
    pass


class BankClient:
    """Facade for bank account operations used by the AR & Reconciliation Agent."""

    def __init__(self, base_url: str, client_id: str, client_secret: str) -> None:
        self.base_url = base_url
        self.client_id = client_id
        self.client_secret = client_secret
        logger.info("BankClient initialised")

    def get_new_transactions(
        self,
        account_id: str,
        since: date,
    ) -> list[Payment]:
        """
        Fetch credit transactions (incoming payments) since a given date.
        Returns a list of Payment objects.
        """
        logger.info(
            "[BANK PLACEHOLDER] get_new_transactions: account=%s since=%s",
            account_id,
            since,
        )
        # TODO: GET /accounts/{account_id}/transactions?from={since}&type=credit
        return []

    def get_account_balance(self, account_id: str) -> dict[str, Any]:
        """Return current balance for the given account."""
        logger.info("[BANK PLACEHOLDER] get_account_balance: account=%s", account_id)
        # TODO: GET /accounts/{account_id}/balance
        return {"account_id": account_id, "balance": 0, "currency": "EUR"}

    def initiate_payment(
        self,
        creditor_iban: str,
        amount: float,
        currency: str,
        reference: str,
    ) -> str:
        """
        Initiate an outgoing payment (used by AP payment queue processing).
        Returns a bank payment instruction ID.
        """
        logger.info(
            "[BANK PLACEHOLDER] initiate_payment: iban=%s amount=%s %s ref=%s",
            creditor_iban,
            amount,
            currency,
            reference,
        )
        # TODO: POST /payment-initiations
        return f"BANK-PAY-{reference[:8]}"
