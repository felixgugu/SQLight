@echo off
REM ========================================================================
REM SQLight - Portable Build Launcher
REM Delegates execution to build-portable.ps1 (UTF-8 with BOM)
REM ========================================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-portable.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build process failed.
    pause
)
