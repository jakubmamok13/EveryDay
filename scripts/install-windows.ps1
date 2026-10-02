#Requires -RunAsAdministrator
<#
  EveryDay — start automatically on this Windows PC (D-012, D-030).
  - Registers a scheduled task "EveryDay" that starts at boot (even before
    you log in) and restarts if it ever stops.
  - Turns off sleep/hibernate on mains power, so the morning brief is made.
  Run from the EveryDay folder in an *administrator* PowerShell:
    powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root "data\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$cmdArgs = "/c cd /d `"$root`" && `"$npm`" start >> `"$logDir\server.log`" 2>&1"

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $cmdArgs -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
# S4U: runs whether or not you are logged in, without storing your password.
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited

Register-ScheduledTask -TaskName "EveryDay" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

Start-ScheduledTask -TaskName "EveryDay"
Write-Host ""
Write-Host "EveryDay is installed and running: http://localhost:8787"
Write-Host "Logs: $logDir\server.log"
Write-Host "Phone access: tailscale serve --bg 8787   (see README)"
