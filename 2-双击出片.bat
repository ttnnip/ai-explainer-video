@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 出片
set "ROOT=%~dp0"
set "SCRIPT_JSON=%ROOT%稿子.json"
set "BUILD_DIR=%ROOT%程序文件\template\build"
set "PYTHONIOENCODING=utf-8"
set "PY=%ROOT%程序文件\.venv\Scripts\python.exe"

if not exist "%ROOT%程序文件\node_modules" goto noenv
if not exist "%PY%" goto noenv

echo.
echo ============================================================
echo   第 1 步：声音
echo ============================================================
set "REC="
for %%f in ("我的录音\*.m4a" "我的录音\*.mp3" "我的录音\*.wav" "我的录音\*.aac" "我的录音\*.flac") do set "REC=%%~ff"
if defined REC (
  echo   用你的录音：%REC%
  "%PY%" "程序文件\template\voice.py" --rec "%REC%"
) else (
  echo   「我的录音」里没有音频，使用 AI 配音（需要联网；音色在「稿子.json」的 voice 里改）
  "%PY%" "程序文件\template\voice.py"
)
if errorlevel 1 goto fail

echo.
echo ============================================================
echo   第 2 步：生成画面（每 1 秒视频大约要 10-15 秒，请耐心等）
echo ============================================================
node "程序文件\template\render.js"
if errorlevel 1 goto fail

echo.
echo ============================================================
echo   第 3 步：混音、合成成片
echo ============================================================
for /f %%t in ('powershell -nologo -noprofile -command "Get-Date -Format yyyyMMdd-HHmm"') do set "TS=%%t"
set "OUT_MP4=%ROOT%成片\成片-%TS%.mp4"
"%PY%" "程序文件\template\mix.py"
if errorlevel 1 goto fail

echo.
echo ============================================================
echo   完成！成片在「成片」文件夹：成片-%TS%.mp4
echo ============================================================
start "" "%ROOT%成片"
pause
exit /b

:noenv
echo.
echo   还没安装环境，请先双击「1-双击安装环境.bat」。
pause
exit /b

:fail
echo.
echo   出错了。最常见的原因：
echo   1）稿子.json 格式写错了（少了逗号、引号）——把稿子.json 内容发给 AI，让它检查格式
echo   2）录音里句子之间停顿太短，切出来的句数和稿子对不上——每句之间停半秒重录
echo   3）其他报错：把上面的报错整段复制给 AI，或者发到粉丝群里问我
pause
