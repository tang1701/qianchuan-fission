# 打包 Windows 安装包（避开桌面目录 EPERM / GitHub 超时）
$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $Root

$Out = Join-Path $env:TEMP 'eauto-pack-out'
Remove-Item -Recurse -Force $Out -ErrorAction SilentlyContinue

$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'

Write-Host ">>> npm run build" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ">>> electron-builder (output: $Out)" -ForegroundColor Cyan
npx electron-builder --win --config.directories.output=$Out
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$Dest = Join-Path $Root 'release'
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Get-ChildItem -Path $Out -Filter '*.exe' | Copy-Item -Force -Destination $Dest

Write-Host ""
Write-Host "完成。安装包已复制到:" -ForegroundColor Green
Get-ChildItem -Path $Dest -Filter '*Setup*.exe' | ForEach-Object { Write-Host "  $($_.FullName)" }
