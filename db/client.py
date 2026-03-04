"""
Supabase client — singleton factory.

Python agents use the SERVICE KEY (bypasses RLS) for full read/write access.
The React frontend uses the ANON KEY (respects RLS policies).
"""

import logging
import os
from typing import Optional

try:
    from supabase import create_client, Client
    _SUPABASE_AVAILABLE = True
except ImportError:
    _SUPABASE_AVAILABLE = False
    Client = None  # type: ignore

logger = logging.getLogger(__name__)

_client: Optional["Client"] = None  # type: ignore


def get_supabase_client() -> "Client":  # type: ignore
    """
    Return (and lazily initialise) the singleton Supabase client.

    Required environment variables:
        SUPABASE_URL         — your project URL, e.g. https://xyz.supabase.co
        SUPABASE_SERVICE_KEY — service_role key (server-side only, never expose to browser)
    """
    global _client
    if _client is not None:
        return _client

    if not _SUPABASE_AVAILABLE:
        raise RuntimeError(
            "supabase-py is not installed. Run: pip install supabase"
        )

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")

    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set. "
            "Copy .env.example to .env and fill in your Supabase credentials."
        )

    _client = create_client(url, key)
    logger.info("Supabase client initialised (url=%s…)", url[:30])
    return _client
