@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 安装环境
echo.
echo ============================================================
echo   第 1 步：检查电脑里有没有 Node.js、Python、ffmpeg
echo ============================================================
set "MISSING="
node --version >nul 2>nul || set "MISSING=%MISSING% Node.js"
python --version >nul 2>nul || set "MISSING=%MISSING% Python"
ffmpeg -version >nul 2>nul || set "MISSING=%MISSING% ffmpeg"

if "%MISSING%"=="" goto deps

echo.
echo   还缺这些软件：%MISSING%
echo.
echo   可以用 Windows 自带的 winget 自动安装（大约 5-10 分钟）。
choice /c YN /m "  现在自动安装吗？按 Y 安装，按 N 看手动安装方法"
if errorlevel 2 goto manual

echo %MISSING% | find "Node.js" >nul && winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
echo %MISSING% | find "Python" >nul && winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
echo %MISSING% | find "ffmpeg" >nul && winget install -e --id Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
echo.
echo   软件装好了。请【关闭这个窗口】，再重新双击运行一次「1-双击安装环境.bat」。
echo   （新装的软件要重新打开窗口才能被找到）
pause
exit /b

:manual
echo.
echo   手动安装方法见「0-先看我-完整教程.html」第 2 步。装好后重新双击本文件。
pause
exit /b

:deps
echo   三个软件都有了。
echo.
echo ============================================================
echo   第 2 步：安装依赖（用国内镜像，速度更快）
echo ============================================================
cd 程序文件
call npm install --registry=https://registry.npmmirror.com
if errorlevel 1 goto fail
if not exist ".venv" python -m venv .venv
".venv\Scripts\python.exe" -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
if errorlevel 1 goto fail
echo.
echo ============================================================
echo   安装完成！
echo   下一步：双击「2-双击出片.bat」，先做一条示例视频看看效果。
echo ============================================================
pause
exit /b

:fail
echo.
echo   安装出错了。把上面红字/报错整段复制给 AI（豆包、DeepSeek 都行），
echo   问它“这个报错怎么解决”，或者发到粉丝群里问我。
pause
