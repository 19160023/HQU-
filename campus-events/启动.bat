@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=8080
set "NODE_EXE="

rem 依次找 Node：PATH → 常见安装位置 → 本机 DeepSeek Harness 自带的运行时（兜底）
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"

if not defined NODE_EXE (
  echo.
  echo 没找到 Node.js。
  echo 这个版本用到了 Node 内置的 SQLite，需要 Node 22.5 或更高版本。
  echo 下载地址： https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo 用 %NODE_EXE% 启动本地服务和数据库...
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PORT%'"
"%NODE_EXE%" server\server.mjs %PORT%

echo.
echo 服务器已停止。
pause
