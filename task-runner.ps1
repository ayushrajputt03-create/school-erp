Set-Location -LiteralPath $PSScriptRoot
$log = Join-Path $PSScriptRoot 'server-task.log'
"[$(Get-Date -Format s)] Starting Northstar School OS" | Out-File -LiteralPath $log -Append
& 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'serve.mjs') *>> $log
"[$(Get-Date -Format s)] Server exited with code $LASTEXITCODE" | Out-File -LiteralPath $log -Append
