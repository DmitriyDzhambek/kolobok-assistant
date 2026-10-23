"""Пакет backend: локальный desktop-бэкенд Колобка и serverless-вход Vercel.

Добавляет собственную папку в sys.path, чтобы плоские импорты модулей
(`import db`, `import llm`, `from tg_auth import ...`) работали и при
импорте пакета целиком (`from backend.macro_server import app`),
как это делает api/index.py на Vercel.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
