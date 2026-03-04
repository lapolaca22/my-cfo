"""
File Storage Integration — placeholder implementation.

Replace method bodies with real calls to your file storage system
(e.g. local filesystem, SharePoint, Google Drive, S3, SFTP).
"""

import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class FileStorageError(Exception):
    pass


class FileStorageClient:
    """
    Facade for reading files from a shared folder / document store.
    Used by both the AP Agent (invoice attachments) and the
    Accounting Agent (payroll files, investment statements).
    """

    def __init__(self, base_path: str, credentials: Optional[dict] = None) -> None:
        self.base_path = Path(base_path)
        self.credentials = credentials or {}
        logger.info("FileStorageClient initialised (base=%s)", self.base_path)

    def list_new_files(self, subfolder: str, extensions: tuple[str, ...]) -> list[Path]:
        """
        List files in a subfolder that match the given extensions and
        have not yet been processed (determined by the absence of a
        '.processed' marker or equivalent mechanism).
        """
        logger.info(
            "[STORAGE PLACEHOLDER] list_new_files: folder=%s ext=%s",
            subfolder,
            extensions,
        )
        # TODO: scan local path or call remote storage API
        return []

    def read_file(self, file_path: Path) -> bytes:
        """Read and return raw bytes for a file."""
        logger.info("[STORAGE PLACEHOLDER] read_file: %s", file_path)
        # TODO: open file or download from remote
        return b""

    def mark_as_processed(self, file_path: Path) -> None:
        """
        Mark a file as processed so it is not picked up again.
        Convention: create a sibling file <original>.processed.
        """
        logger.info("[STORAGE PLACEHOLDER] mark_as_processed: %s", file_path)
        # TODO: create marker file or update storage metadata

    def write_file(self, subfolder: str, filename: str, content: bytes) -> Path:
        """Write output files (e.g. generated reports) to the storage."""
        logger.info(
            "[STORAGE PLACEHOLDER] write_file: folder=%s name=%s size=%d bytes",
            subfolder,
            filename,
            len(content),
        )
        # TODO: write locally or upload to remote storage
        return self.base_path / subfolder / filename
