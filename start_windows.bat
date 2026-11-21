@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Uruchamianie FESTIVAL'S LIFE v3 Dashboard...
where python >nul 2>nul
if %errorlevel%==0 (
    python app.py
) else (
    py app.py
)
pause
