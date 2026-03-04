from .business_central import BusinessCentralClient, BCError
from .erp import ERPClient, ERPError   # backward-compat aliases
from .bank import BankClient
from .crm import CRMClient
from .email_client import EmailClient
from .file_storage import FileStorageClient

__all__ = [
    "BusinessCentralClient", "BCError",
    "ERPClient", "ERPError",            # legacy aliases
    "BankClient",
    "CRMClient",
    "EmailClient",
    "FileStorageClient",
]
