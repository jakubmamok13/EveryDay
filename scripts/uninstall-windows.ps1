#Requires -RunAsAdministrator
# Removes the EveryDay scheduled task. Your data in the data\ folder stays.
Stop-ScheduledTask -TaskName "EveryDay" -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EveryDay" -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "EveryDay task removed. Data kept in the data folder."
