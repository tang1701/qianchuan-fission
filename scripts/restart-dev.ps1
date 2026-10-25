# 结束 EAuto 开发占用并重新启动（不关闭其它项目的 5173）
$ErrorActionPreference = 'SilentlyContinue'
$port = 17319

Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object {
  if ($_.CommandLine -match 'Desktop\\EAuto' -and $_.CommandLine -match 'vite') {
    Stop-Process -Id $_.ProcessId -Force
  }
}

Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | ForEach-Object {
  if ($_.CommandLine -match 'Desktop\\EAuto' -or $_.CommandLine -match 'ECutAuto') {
    Stop-Process -Id $_.ProcessId -Force
  }
}

Start-Sleep -Seconds 1
$listen = netstat -ano | Select-String "127.0.0.1:$port.*LISTENING"
if ($listen) {
  Write-Host "端口 $port 仍被占用，请手动结束 PID: $($listen -replace '.*\s(\d+)$','$1')"
  exit 1
}

Set-Location (Split-Path $PSScriptRoot -Parent)
Write-Host "正在启动 npm run dev:app …"
npm run dev:app
