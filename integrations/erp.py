"""
ERP integration — backward-compatibility shim.

BusinessCentralClient is now the canonical ERP implementation.
This module re-exports it under the legacy ERPClient name so that any code
that has not yet been updated continues to work without import changes.

New code should import directly from integrations.business_central:
    from integrations.business_central import BusinessCentralClient, BCError
"""

from .business_central import BusinessCentralClient, BCError

# Legacy aliases — keeps existing `from integrations.erp import ERPClient` working
ERPClient = BusinessCentralClient
ERPError  = BCError

__all__ = ["ERPClient", "ERPError", "BusinessCentralClient", "BCError"]
