@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Starting Keycap Generator / 正在启动键帽生成器...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8765
pause
