@echo off
title Roads of Rogue - Roster Generator
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not on PATH - install it or add it, then retry.
  pause
  exit /b 1
)

rem Make sure Ollama is up (same as Year7Learn does).
curl -s -o nul -m 3 http://127.0.0.1:11434/api/tags
if errorlevel 1 (
  echo Starting Ollama...
  start "" "%LOCALAPPDATA%\Programs\Ollama\ollama app.exe"
  timeout /t 4 /nobreak >nul
)

rem Pass through any args, e.g. Start-Generate-Roster.bat --theme "riot cops" --enemies 6
node tools\generate.mjs %*

echo.
pause
