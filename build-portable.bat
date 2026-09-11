@echo off
chcp 65001 >nul 2>&1
title SQLight - ?格???鋆???蝔?

cd /d "%~dp0"

echo ========================================================================
echo   SQLight - ?格???鋆? (Portable) ?芸?撱箇蔭????echo ========================================================================
echo.

REM 1. 瑼Ｘ蝟餌絞蝺刻陌?啣? (Node.js, npm, Rust/Cargo)
echo [1/4] 瑼Ｘ蝟餌絞蝺刻陌?啣?...
where node >nul 2>&1
if errorlevel 1 goto :err_node

where npm >nul 2>&1
if errorlevel 1 goto :err_npm

where cargo >nul 2>&1
if errorlevel 1 goto :err_cargo

echo   - Node.js: OK
echo   - npm:     OK
echo   - Cargo:   OK
echo.

REM 2. 皞?頛詨?桅?
echo [2/4] 皞?頛詨?桅? (dist-portable)...
set OUT_DIR=%~dp0dist-portable
if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
echo   - 頛詨頝臬?: %OUT_DIR%
echo.

REM 3. ?瑁??格???鋆遣蝵?(頝喲? MSI / NSIS 摰???
echo [3/4] ??撱箇蔭?格???鋆?撘?(Frontend + Rust Core)...
echo   - ?瑁?: npm run build:portable
echo   - 隢???甇??脰??垢????Rust release ?雿喳?蝺刻陌...
echo.

call npm run build:portable
if errorlevel 1 goto :err_build
echo.

REM 4. 撠蝺刻陌敺??瑁?瑼蒂銴ˊ?啗撓?箇??echo [4/4] 甇???銝血?箏?摰??瑁?瑼?..
set EXE_SRC=

if exist "%~dp0src-tauri\target\x86_64-pc-windows-gnu\release\sqlight.exe" set EXE_SRC=%~dp0src-tauri\target\x86_64-pc-windows-gnu\release\sqlight.exe
if not defined EXE_SRC if exist "%~dp0src-tauri\target\x86_64-pc-windows-gnu\release\SQLight.exe" set EXE_SRC=%~dp0src-tauri\target\x86_64-pc-windows-gnu\release\SQLight.exe
if not defined EXE_SRC if exist "%~dp0src-tauri\target\release\sqlight.exe" set EXE_SRC=%~dp0src-tauri\target\release\sqlight.exe
if not defined EXE_SRC if exist "%~dp0src-tauri\target\release\SQLight.exe" set EXE_SRC=%~dp0src-tauri\target\release\SQLight.exe
if not defined EXE_SRC if exist "%~dp0src-tauri\target\x86_64-pc-windows-msvc\release\sqlight.exe" set EXE_SRC=%~dp0src-tauri\target\x86_64-pc-windows-msvc\release\sqlight.exe
if not defined EXE_SRC if exist "%~dp0src-tauri\target\x86_64-pc-windows-msvc\release\SQLight.exe" set EXE_SRC=%~dp0src-tauri\target\x86_64-pc-windows-msvc\release\SQLight.exe

if not defined EXE_SRC goto :err_exe_not_found

set TARGET_EXE=%OUT_DIR%\SQLight.exe
copy /y "%EXE_SRC%" "%TARGET_EXE%" >nul
if errorlevel 1 goto :err_copy

echo.
echo ========================================================================
echo   [摰?] SQLight ?格???鋆?撘歇????嚗?echo ========================================================================
echo   瑼??迂: SQLight.exe
echo   摰頝臬?: %TARGET_EXE%
powershell -NoProfile -Command "$f = Get-Item '%TARGET_EXE%'; Write-Host ('  瑼?憭批?: ' + [math]::Round($f.Length / 1MB, 2) + ' MB (' + $f.Length.ToString('N0') + ' bytes)')"
echo.
echo   隤芣?: 甇斗?獢蝬??鋆蝡銵?嚗??閬銵?鋆?撘?
echo         ?舐?亥?鋆賢隞颱??餉?頨怎???銵?echo ========================================================================
echo.

REM ??頛詨鞈?憭曆蒂?詨?閰脣銵?
start "" explorer.exe /select,"%TARGET_EXE%"
goto :end

:err_node
echo.
echo [?航炊] ?曆???Node.js嚗?蝣箄?撌脣?鋆?Node.js 銝西身摰憓???PATH??goto :error

:err_npm
echo.
echo [?航炊] ?曆???npm嚗?蝣箄?撌脣?鋆?npm 銝西身摰憓???PATH??goto :error

:err_cargo
echo.
echo [?航炊] ?曆???Rust / Cargo嚗?蝣箄?撌脣?鋆?Rust 銝西身摰憓???PATH??goto :error

:err_build
echo.
echo [?航炊] 撱箇蔭??憭望?嚗?瑼Ｘ銝?航炊蝝??goto :error

:err_exe_not_found
echo.
echo [?航炊] ?曆??啁楊霅臬??銵?嚗?瑼Ｘ src-tauri\target\ ?桅???goto :error

:err_copy
echo.
echo [?航炊] 銴ˊ?瑁?瑼 %OUT_DIR% 憭望???goto :error

:error
echo.
echo ========================================================================
echo   [憭望?] ??????航炊嚗??銝閮?脰????echo ========================================================================
echo.

:end
pause
