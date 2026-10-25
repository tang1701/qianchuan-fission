# 个人电脑：关闭 Smart App Control / 开启开发者模式，以便运行 node_modules\electron
# 必须以管理员运行（脚本会尝试自动提权）

param([switch]$NoPause)

function Test-IsAdmin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
  Write-Host "正在请求管理员权限（请在 UAC 窗口点「是」）…" -ForegroundColor Yellow
  $self = $PSCommandPath
  $args = if ($NoPause) { '-NoPause' } else { '' }
  Start-Process powershell.exe -Verb RunAs -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', "`"$self`"",
    $args
  ) -Wait
  exit $LASTEXITCODE
}

Write-Host "`n=== EAuto：修复 Electron 被系统拦截 ===`n" -ForegroundColor Cyan

$root = Split-Path $PSScriptRoot -Parent

$policyPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy'
if (Test-Path $policyPath) {
  $before = (Get-ItemProperty -Path $policyPath -ErrorAction SilentlyContinue).VerifiedAndReputablePolicyState
  Set-ItemProperty -Path $policyPath -Name 'VerifiedAndReputablePolicyState' -Value 0 -Type DWord
  Write-Host "[OK] Smart App Control 策略: $before -> 0 (VerifiedAndReputablePolicyState)"
} else {
  Write-Host "[跳过] 未找到 CI\Policy 注册表项"
}

$devPath = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock'
if (-not (Test-Path $devPath)) {
  New-Item -Path $devPath -Force | Out-Null
}
Set-ItemProperty -Path $devPath -Name 'AllowDevelopmentWithoutDevLicense' -Value 1 -Type DWord -Force
Write-Host "[OK] 已开启 Windows 开发人员模式 (AllowDevelopmentWithoutDevLicense)"

$hvci = 'HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity'
if (Test-Path $hvci) {
  $en = (Get-ItemProperty -Path $hvci).Enabled
  if ($en -eq 1) {
    Set-ItemProperty -Path $hvci -Name 'Enabled' -Value 0 -Type DWord
    Write-Host "[OK] 已关闭「内存完整性」(HVCI)，重启后生效 (Enabled: 1 -> 0)"
  } else {
    Write-Host "[信息] 内存完整性已是关闭状态"
  }
}

Write-Host "`n同时安装 WinGet 版 Electron（无需关闭 Smart App 也可开发）…" -ForegroundColor Cyan
Set-Location $root
npm run setup:electron-win 2>$null

Write-Host "`n建议：`n  1. 重启电脑（仅当上面改了 HVCI）`n  2. npm run doctor:electron`n  3. npm run dev:app`n" -ForegroundColor Green

Set-Location $root
Write-Host "正在测试 Electron …"
npm run doctor:electron
$code = $LASTEXITCODE

if (-not $NoPause) {
  Read-Host "`n按 Enter 关闭窗口"
}
exit $code
