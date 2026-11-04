$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$karsNodeCommand = Get-Command node -ErrorAction SilentlyContinue
$karsNodePath = if ($karsNodeCommand) { $karsNodeCommand.Source } else {
  Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if (-not (Test-Path -LiteralPath $karsNodePath)) { throw 'Install Node.js 22 or newer, then run npm ci and npm run dev.' }
if (-not (Test-Path -LiteralPath '.\node_modules\next\dist\bin\next')) { throw 'Dependencies are missing. Run npm ci in this folder first.' }
if (-not (Test-Path -LiteralPath '.\.env.local')) { throw 'Copy .env.example to .env.local and add your Supabase URL and publishable key.' }
Write-Host 'Opening Kars Recon at http://127.0.0.1:3000. Keep this terminal open.'
& $karsNodePath '.\node_modules\next\dist\bin\next' dev --hostname 127.0.0.1
exit $LASTEXITCODE
