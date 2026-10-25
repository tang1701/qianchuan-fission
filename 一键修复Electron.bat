@echo off
chcp 65001 >nul
echo.
echo 需要管理员权限才能关闭「智能应用控制」。
echo 请在弹出的 UAC 窗口点击「是」。
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\fix-electron-windows.ps1"
pause
