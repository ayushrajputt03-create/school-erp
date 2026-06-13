$url = 'http://127.0.0.1:5173/?build=northstar'
$running = Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue

if (-not $running) {
  Start-ScheduledTask -TaskName 'Northstar School OS'
  $deadline = (Get-Date).AddSeconds(12)
  do {
    Start-Sleep -Milliseconds 400
    $running = Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue
  } until ($running -or (Get-Date) -gt $deadline)
}

if ($running) {
  Start-Process $url
} else {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    'School ERP server could not start. Open Task Scheduler and run "Northstar School OS".',
    'Northstar School OS'
  ) | Out-Null
}
