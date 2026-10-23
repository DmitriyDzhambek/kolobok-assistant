@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   Колобок — макрос-рекордер (автокликер)
echo ============================================================
where python >nul 2>nul
if errorlevel 1 (
  echo [!] Python не найден.
  echo     Установите Python 3: https://www.python.org/downloads/
  echo     При установке ОБЯЗАТЕЛЬНО поставьте галочку "Add Python to PATH".
  pause
  exit /b 1
)
if not exist ".venv" (
  echo Создаю виртуальное окружение .venv ...
  python -m venv .venv
  if errorlevel 1 (
    echo [!] Не удалось создать окружение.
    pause
    exit /b 1
  )
)
call ".venv\Scripts\activate.bat"
echo Устанавливаю зависимости (fastapi, uvicorn, pynput, pyautogui)...
pip install -r requirements.txt
if errorlevel 1 (
  echo [!] Ошибка установки зависимостей — проверьте интернет.
  pause
  exit /b 1
)
echo.
echo Запускаю сервер на http://127.0.0.1:8765
echo В Колобке нажмите кнопку с мышкой на нижней панели.
echo Остановить сервер: Ctrl+C в этом окне.
echo.
python macro_server.py
pause
