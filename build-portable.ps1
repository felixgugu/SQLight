param(
    [switch]$NoPause
)

# ========================================================================
# SQLight - 單機免安裝版 (Portable) 自動建置與打包指令碼
# 編碼規範：UTF-8 with BOM (相容 Windows PowerShell 5.1 與 PowerShell 7+)
# ========================================================================

# 強制設定主控台與管線字元編碼為 UTF-8，徹底杜絕 Windows 終端亂碼
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 >$null 2>&1

$Host.UI.RawUI.WindowTitle = "SQLight - 單機免安裝版打包程式"

# 確保工作目錄為當前指令碼所在目錄
Set-Location -LiteralPath $PSScriptRoot

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  SQLight - 單機免安裝版 (Portable) 自動建置與打包" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""

function Stop-Script ($msg) {
    Write-Host ""
    Write-Host "[錯誤] $msg" -ForegroundColor Red
    if (-not $NoPause) {
        Read-Host "按 Enter 鍵結束..."
    }
    exit 1
}

function Test-CommandAvailable ($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

# ------------------------------------------------------------------------
# 1. 檢查系統編譯環境 (Node.js, npm, Rust/Cargo)
# ------------------------------------------------------------------------
Write-Host "[1/5] 正在檢查系統編譯環境..." -ForegroundColor Yellow

if (-not (Test-CommandAvailable "node")) {
    Stop-Script "找不到 Node.js，請確認已安裝 Node.js 並設定環境變數 PATH。"
}

if (-not (Test-CommandAvailable "npm")) {
    Stop-Script "找不到 npm，請確認已安裝 npm 並設定環境變數 PATH。"
}

if (-not (Test-CommandAvailable "cargo")) {
    Stop-Script "找不到 Rust / Cargo，請確認已安裝 Rust 並設定環境變數 PATH。"
}

Write-Host "  - Node.js: OK ($(node --version))" -ForegroundColor Green
Write-Host "  - npm:     OK (v$(npm --version))" -ForegroundColor Green
Write-Host "  - Cargo:   OK ($(cargo --version))" -ForegroundColor Green
Write-Host ""

# ------------------------------------------------------------------------
# 2. 準備輸出目錄
# ------------------------------------------------------------------------
Write-Host "[2/5] 準備輸出目錄 (dist-portable)..." -ForegroundColor Yellow
$OutDir = "$PSScriptRoot\dist-portable"
if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}
Write-Host "  - 輸出路徑: $OutDir" -ForegroundColor Gray
Write-Host ""

# ------------------------------------------------------------------------
# 3. 執行單機免安裝建置 (跳過 MSI / NSIS 安裝包)
# ------------------------------------------------------------------------
Write-Host "[3/5] 開始建置單機免安裝程式 (Frontend + Rust Core)..." -ForegroundColor Yellow
Write-Host "  - 執行: npm run build:portable" -ForegroundColor Gray
Write-Host "  - 請稍候，正在進行前端打包與 Rust release 最佳化編譯..." -ForegroundColor Gray
Write-Host ""

& npm run build:portable
if ($LASTEXITCODE -ne 0) {
    Stop-Script "建置過程失敗，請檢查上方編譯紀錄。"
}
Write-Host ""

# ------------------------------------------------------------------------
# 4. 尋找編譯後的執行檔並複製到輸出目錄
# ------------------------------------------------------------------------
Write-Host "[4/5] 正在匯出免安裝執行檔與相依函式庫..." -ForegroundColor Yellow

$CandidateExes = @(
    "$PSScriptRoot\src-tauri\target\x86_64-pc-windows-gnu\release\sqlight.exe",
    "$PSScriptRoot\src-tauri\target\x86_64-pc-windows-gnu\release\SQLight.exe",
    "$PSScriptRoot\src-tauri\target\release\sqlight.exe",
    "$PSScriptRoot\src-tauri\target\release\SQLight.exe",
    "$PSScriptRoot\src-tauri\target\x86_64-pc-windows-msvc\release\sqlight.exe",
    "$PSScriptRoot\src-tauri\target\x86_64-pc-windows-msvc\release\SQLight.exe"
)

$ExeSrc = $null
foreach ($path in $CandidateExes) {
    if (Test-Path $path) {
        $ExeSrc = $path
        break
    }
}

if (-not $ExeSrc) {
    Stop-Script "找不到編譯後的執行檔，請檢查 src-tauri\target\ 目錄。"
}

$TargetExe = "$OutDir\SQLight.exe"
Copy-Item -LiteralPath $ExeSrc -Destination $TargetExe -Force
Write-Host "  - 已匯出主程式: $TargetExe" -ForegroundColor Green

# 搜尋並複製 WebView2Loader.dll (MinGW/GNU 工具鏈必要相依)
$CandidateDlls = @(
    "$PSScriptRoot\src-tauri\target\x86_64-pc-windows-gnu\release\WebView2Loader.dll",
    "$PSScriptRoot\src-tauri\target\release\WebView2Loader.dll",
    "$PSScriptRoot\src-tauri\target\x86_64-pc-windows-msvc\release\WebView2Loader.dll"
)

$DllSrc = $null
foreach ($path in $CandidateDlls) {
    if (Test-Path $path) {
        $DllSrc = $path
        break
    }
}

$HasDll = $false
if ($DllSrc) {
    Copy-Item -LiteralPath $DllSrc -Destination "$OutDir\WebView2Loader.dll" -Force
    $HasDll = $true
    Write-Host "  - 已包含 WebView2Loader.dll (Microsoft Edge WebView2 載入模組)" -ForegroundColor Green
}

# 複製預設自訂範本檔 (若存在)
$CustomTplSrc = "$PSScriptRoot\src-tauri\sql_custom_templates.json"
if (Test-Path $CustomTplSrc) {
    Copy-Item -LiteralPath $CustomTplSrc -Destination "$OutDir\sql_custom_templates.json" -Force
    Write-Host "  - 已包含 sql_custom_templates.json (常用 SQL 自訂範本文件)" -ForegroundColor Green
}
Write-Host ""

# ------------------------------------------------------------------------
# 5. 製作免安裝可攜版壓縮檔 (方便分享與攜帶)
# ------------------------------------------------------------------------
Write-Host "[5/5] 正在打包可攜版壓縮檔 (SQLight-Portable.zip)..." -ForegroundColor Yellow

$ZipPath = "$OutDir\SQLight-Portable.zip"
if (Test-Path $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
}

$ItemsToZip = @($TargetExe)
if ($HasDll) {
    $ItemsToZip += "$OutDir\WebView2Loader.dll"
}
$OutCustomTpl = "$OutDir\sql_custom_templates.json"
if (Test-Path $OutCustomTpl) {
    $ItemsToZip += $OutCustomTpl
}

Compress-Archive -LiteralPath $ItemsToZip -DestinationPath $ZipPath -Force
if (Test-Path $ZipPath) {
    Write-Host "  - 壓縮檔建立成功: $ZipPath" -ForegroundColor Green
}
Write-Host ""

# ------------------------------------------------------------------------
# 顯示完成資訊與大小摘要
# ------------------------------------------------------------------------
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  [完成] SQLight 單機免安裝程式已打包成功！" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

$ExeItem = Get-Item $TargetExe
$ExeSizeMB = [math]::Round($ExeItem.Length / 1MB, 2)
Write-Host "  執行檔: $TargetExe" -ForegroundColor White
Write-Host "  檔案大小: $ExeSizeMB MB ($($ExeItem.Length.ToString('N0')) bytes)" -ForegroundColor Gray

if (Test-Path $ZipPath) {
    $ZipItem = Get-Item $ZipPath
    $ZipSizeMB = [math]::Round($ZipItem.Length / 1MB, 2)
    Write-Host "  壓縮檔:   $ZipPath" -ForegroundColor Green
    Write-Host "  壓縮大小: $ZipSizeMB MB ($($ZipItem.Length.ToString('N0')) bytes)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "  【重要使用說明】" -ForegroundColor Yellow
Write-Host "  1. 此版本為綠色免安裝版，不需要執行任何安裝精靈或管理員權限。" -ForegroundColor White
Write-Host "  2. 在 Windows 平台上，執行檔與 WebView2Loader.dll 及自訂範本放在一起。" -ForegroundColor White
Write-Host "  3. 只要將 dist-portable 資料夾（或 SQLight-Portable.zip 解壓縮後的內容）" -ForegroundColor White
Write-Host "     複製到任何電腦或隨身碟，雙擊 SQLight.exe 即可直接運行！" -ForegroundColor White
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not $NoPause) {
    # 開啟輸出資料夾並反白選取該執行檔
    Start-Process explorer.exe -ArgumentList "/select,`"$TargetExe`""
    Read-Host "按 Enter 鍵結束..."
}

