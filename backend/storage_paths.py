"""Выбор writable-каталога для JSON-хранилищ Колобка.

Локально (Windows/desktop-бэкенд) данные живут в backend/data/.
На Vercel filesystem доступна только для чтения, поэтому при первой же
попытке записи делаем fallback в tempfile.gettempdir() (/tmp) — данные
живут между запросами одного instance, а production-персистентность
даёт DATABASE_URL (PostgreSQL).
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path


def writable_data_dir(default: Path) -> Path:
	"""Каталог для habits.json/chat.json: default, KOLOBOK_DATA_DIR или /tmp."""
	override = os.environ.get("KOLOBOK_DATA_DIR", "").strip()
	candidate = Path(override) if override else default
	for d in (candidate, Path(tempfile.gettempdir()) / "kolobok-data"):
		try:
			d.mkdir(parents=True, exist_ok=True)
			probe = d / ".write-test"
			probe.write_text("ok", encoding="utf-8")
			probe.unlink()
			return d
		except OSError:
			continue
	return candidate  # не должно случиться: /tmp writable всегда


def writable_file(env_name: str, default: Path) -> Path:
	"""Путь файла: явный env-override либо default в writable-каталоге."""
	override = os.environ.get(env_name, "").strip()
	if override:
		return Path(override)
	return writable_data_dir(default.parent) / default.name
