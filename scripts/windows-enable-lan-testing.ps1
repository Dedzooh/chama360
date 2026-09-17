param(
  [switch]$Disable
)

$ErrorActionPreference = 'Stop'
$ruleName = 'CHAMA360 local testing (TCP 3000, 5173)'
$ports = @(3000, 5173)
$isAdministrator = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdministrator) {
  $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
  if ($Disable) { $arguments += '-Disable' }
  Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
  exit
}

foreach ($port in $ports) {
  & netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=$port | Out-Null
}

$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existingRule) { $existingRule | Remove-NetFirewallRule }

if ($Disable) {
  Write-Host 'CHAMA360 LAN forwarding and firewall rules were removed.' -ForegroundColor Yellow
  exit
}

$wslAddress = ((& wsl.exe hostname -I) -split '\s+' | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' } | Select-Object -First 1)
if (-not $wslAddress) { throw 'Could not determine the current WSL IPv4 address.' }

foreach ($port in $ports) {
  & netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$port connectaddress=$wslAddress connectport=$port | Out-Null
}

New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $ports -RemoteAddress LocalSubnet -Profile Private,Public | Out-Null

$wifiAddress = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -match 'Wi-Fi|Ethernet' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object -ExpandProperty IPAddress -First 1

Write-Host "CHAMA360 LAN access enabled (WSL: $wslAddress)." -ForegroundColor Green
if ($wifiAddress) {
  Write-Host "Website: http://${wifiAddress}:5173"
  Write-Host "API:     http://${wifiAddress}:3000/health"
}
Write-Host "To remove these rules later, run: $PSCommandPath -Disable"
