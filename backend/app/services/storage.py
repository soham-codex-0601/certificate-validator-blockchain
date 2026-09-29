from pathlib import Path
from uuid import uuid4

from ..config import get_settings

settings = get_settings()


class LocalStorage:
    """
    Development storage adapter.

    For production, replace this adapter with S3/GCS/Azure Blob storage.
    The API stores only an opaque file key in the database.
    """

    def __init__(self) -> None:
        self.root = Path(settings.upload_dir)
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, filename: str, content: bytes) -> str:
        safe_suffix = Path(filename).suffix.lower()
        key = f"{uuid4().hex}{safe_suffix}"
        path = self.root / key
        path.write_bytes(content)
        return key

    def read(self, key: str) -> bytes:
        path = self.root / key
        if not path.exists():
            raise FileNotFoundError("Certificate file not found")
        return path.read_bytes()


storage = LocalStorage()
