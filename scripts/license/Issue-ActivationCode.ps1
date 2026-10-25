# Launcher only (ASCII) - opens HTA GUI to avoid PowerShell UTF-8 parsing issues on Windows PowerShell 5.1
$ErrorActionPreference = 'Stop'
$hta = Join-Path $PSScriptRoot 'Issue-ActivationCode.hta'
if (-not (Test-Path -LiteralPath $hta)) {
  Write-Error "Missing: $hta"
  exit 1
}
Start-Process -FilePath $hta
