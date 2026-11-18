@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 查看 AI 音色
set "PY=%~dp0程序文件\.venv\Scripts\python.exe"
if not exist "%PY%" (
  echo   请先双击「1-双击安装环境.bat」。
  pause
  exit /b
)
echo   正在获取全部中文音色（需要联网）...
"%PY%" "程序文件\template\list_voices.py" "%~dp0AI音色列表.txt"
if errorlevel 1 (
  echo   获取失败，请检查网络后再试。
  pause
  exit /b
)
start "" notepad "%~dp0AI音色列表.txt"
