@echo off
chcp 65001 >nul 2>&1
title SQLight - 單機免安裝版打包程式

cd /d "%~dp0"

echo ========================================================================
echo   SQLight - 單機免安裝版 (Portable) 自動建置與打包
echo ========================================================================
echo.

REM 1. 檢查系統編譯環境 (Node.js, npm, Rust/Cargo)
echo [1/5] 檢查系統編譯環境...
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

REM 2. 準備輸出目錄
echo [2/5] 準備輸出目錄 (dist-portable)...
set OUT_DIR=%~dp0dist-portable
if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
echo   - 輸出路徑: %OUT_DIR%
echo.

REM 3. 執行單機免安裝建置 (跳過 MSI / NSIS 安裝包)
echo [3/5] 開始建置單機免安裝程式 (Frontend + Rust Core)...
echo   - 執行: npm run build:portable
echo   - 請稍候，正在進行前端打包與 Rust release 最佳化編譯...
echo.

call npm run build:portable
if errorlevel 1 goto :err_build
echo.

REM 4. 尋找編譯後的執行檔並複製到輸出目錄
echo [4/5] 正在匯出免安裝執行檔與相依函式庫...
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

REM 搜尋並複製 WebView2Loader.dll (GNU/MinGW 工具鏈必要相依)
set DLL_SRC=
if exist "%~dp0src-tauri\target\x86_64-pc-windows-gnu\release\WebView2Loader.dll" set DLL_SRC=%~dp0src-tauri\target\x86_64-pc-windows-gnu\release\WebView2Loader.dll
if not defined DLL_SRC if exist "%~dp0src-tauri\target\release\WebView2Loader.dll" set DLL_SRC=%~dp0src-tauri\target\release\WebView2Loader.dll
if not defined DLL_SRC if exist "%~dp0src-tauri\target\x86_64-pc-windows-msvc\release\WebView2Loader.dll" set DLL_SRC=%~dp0src-tauri\target\x86_64-pc-windows-msvc\release\WebView2Loader.dll

if defined DLL_SRC (
    copy /y "%DLL_SRC%" "%OUT_DIR%\WebView2Loader.dll" >nul
    echo   - 已包含 WebView2Loader.dll (Microsoft Edge WebView2 載入模組)
)

echo.

REM 5. 製作免安裝可攜版壓縮檔 (方便分享與攜帶)
echo [5/5] 正在打包可攜版壓縮檔 (SQLight-Portable.zip)...
powershell -NoProfile -Command "Compress-Archive -Path '%OUT_DIR%\SQLight.exe', '%OUT_DIR%\WebView2Loader.dll' -DestinationPath '%OUT_DIR%\SQLight-Portable.zip' -Force" 2>nul
if exist "%OUT_DIR%\SQLight-Portable.zip" (
    echo   - 壓縮檔建立成功: %OUT_DIR%\SQLight-Portable.zip
)

echo.
echo ========================================================================
echo   [完成] SQLight 單機免安裝程式已打包成功！
echo ========================================================================
echo   執行檔: %TARGET_EXE%
powershell -NoProfile -Command "$f = Get-Item '%TARGET_EXE%'; Write-Host ('  檔案大小: ' + [math]::Round($f.Length / 1MB, 2) + ' MB (' + $f.Length.ToString('N0') + ' bytes)')"
if exist "%OUT_DIR%\SQLight-Portable.zip" (
    powershell -NoProfile -Command "$z = Get-Item '%OUT_DIR%\SQLight-Portable.zip'; Write-Host ('  壓縮檔:   ' + [math]::Round($z.Length / 1MB, 2) + ' MB (' + $z.FullName + ')') -ForegroundColor Green"
)
echo.
echo   【重要說明】
echo   1. 此版本為綠色免安裝版，不需要執行任何安裝精靈。
echo   2. 在 Windows 平台上（使用 MinGW/GNU 編譯），執行檔需要同目錄下的
echo      WebView2Loader.dll (約 160KB) 才能呼叫系統的 Edge 核心渲染 UI。
echo   3. 只要將 dist-portable 資料夾（或 SQLight-Portable.zip 解壓後的內容）
echo      複製到任何電腦或隨身碟，雙擊 SQLight.exe 即可直接運行！
echo ========================================================================
echo.

REM 開啟輸出資料夾並選取該執行檔
start "" explorer.exe /select,"%TARGET_EXE%"
goto :end

:err_node
echo.
echo [錯誤] 找不到 Node.js，請確認已安裝 Node.js 並設定環境變數 PATH。
goto :error

:err_npm
echo.
echo [錯誤] 找不到 npm，請確認已安裝 npm 並設定環境變數 PATH。
goto :error

:err_cargo
echo.
echo [錯誤] 找不到 Rust / Cargo，請確認已安裝 Rust 並設定環境變數 PATH。
goto :error

:err_build
echo.
echo [錯誤] 建置過程失敗，請檢查上方錯誤紀錄。
goto :error

:err_exe_not_found
echo.
echo [錯誤] 找不到編譯後的執行檔，請檢查 src-tauri\target\ 目錄。
goto :error

:err_copy
echo.
echo [錯誤] 複製執行檔至 %OUT_DIR% 失敗。
goto :error

:error
echo.
echo ========================================================================
echo   [失敗] 打包過程遇到錯誤，請參閱上方訊息進行排查。
echo ========================================================================
echo.

:end
pause
