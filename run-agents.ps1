# Runs the agent task files with YOUR local opencode.
# Usage (in this folder):
#   powershell -ExecutionPolicy Bypass -File run-agents.ps1 -Task T3
#   powershell -ExecutionPolicy Bypass -File run-agents.ps1 -Task T2 -Model deepseek/deepseek-chat
# -Model is optional; without it opencode uses your configured default model.
param(
  [Parameter(Mandatory=$true)][ValidateSet('T1','T2','T3','FIX')][string]$Task,
  [string]$Model = '',
  [string]$FixFile = '',
  [string]$Agent = 'build'
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $MyInvocation.MyCommand.Path)
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$prompts = @{
  'T1' = 'Read tasks/T1-codex-geometry.md and docs/SPEC.md and complete every item of T1 (you are the agent described there). Only edit the files T1 owns. Run node tests/geometry.test.mjs until it passes, write docs/REPORT-T1.md, and end with the line T1-COMPLETE.'
  'T2' = 'Read tasks/T2-codex-legend-export.md, docs/SPEC.md and docs/REPORT-T1.md, then complete every item of T2. Only edit the files T2 owns. Run node tests/legend-export.test.mjs and node tests/geometry.test.mjs until both pass, write docs/REPORT-T2.md, and end with the line T2-COMPLETE.'
  'T3' = 'Read tasks/T3-deepseek-ui-i18n.md and docs/SPEC.md, then complete every item of T3. Some T3 files may already exist from an earlier partial run: inspect and finish them instead of starting over. Only edit the files T3 owns; never create or modify js/keycap.js, js/params.js, js/legend-core.js, js/svg-legend.js, js/export.js or js/manifold-loader.js. Write docs/REPORT-T3.md and end with the line T3-COMPLETE.'
}
if ($Task -eq 'FIX') {
  if (-not $FixFile) { throw 'Use -FixFile tasks/FIX-xx.md' }
  $prompt = "Read $FixFile and docs/SPEC.md and complete every item. Only edit the files listed there. End with the line FIX-COMPLETE."
} else { $prompt = $prompts[$Task] }

New-Item -ItemType Directory -Force -Path logs | Out-Null
$log = Join-Path (Get-Location) "logs\$Task-$(Get-Date -Format yyyyMMdd-HHmmss).log"

# Prefer the real executable / .cmd shim over the opencode.ps1 wrapper.
$exe = $null
$shim = Get-Command opencode.cmd, opencode.ps1, opencode.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $shim) { throw 'opencode not found in PATH' }
if ($shim.Source -like '*.exe') { $exe = $shim.Source }
else {
  $cand = Join-Path (Split-Path $shim.Source) 'node_modules\opencode-ai\bin\opencode.exe'
  $exe = if (Test-Path $cand) { $cand } else { $shim.Source }
}
$oc = [pscustomobject]@{ Source = $exe }

# Use the built-in "build" agent: orchestrator agents (e.g. oh-my-opencode Sisyphus) delegate to
# background sub-agents, and `opencode run` exits as soon as the main turn ends, killing them.
$prompt += ' Do all the work yourself in this session: do NOT delegate to sub-agents or background tasks, and do not stop until the report file is written.'
$ocArgs = @('run', '--agent', $Agent)
if ($Model) { $ocArgs += @('-m', $Model) }
$ocArgs += $prompt

$reportName = if ($Task -eq 'FIX') { 'REPORT-' + ([IO.Path]::GetFileNameWithoutExtension($FixFile) -replace '^(FIX-\d+).*','$1') + '.md' } else { "REPORT-$Task.md" }
$report = Join-Path (Get-Location) "docs\$reportName"
$before = if (Test-Path $report) { (Get-Item $report).LastWriteTime } else { $null }

Write-Host "Running $($oc.Source) --agent $Agent for $Task  (log: $log)" -ForegroundColor Green
# opencode prints progress on stderr; in Windows PowerShell 5.1 that must not be treated as an error.
$ErrorActionPreference = 'Continue'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$writer = New-Object System.IO.StreamWriter($log, $false, $utf8)
try {
  & $oc.Source @ocArgs 2>&1 | ForEach-Object { $line = "$_"; $writer.WriteLine($line); $writer.Flush(); $line }
} finally { $writer.Close() }
$code = $LASTEXITCODE
Write-Host "opencode exit code: $code" -ForegroundColor Yellow
if ((Test-Path $report) -and ((-not $before) -or (Get-Item $report).LastWriteTime -gt $before)) {
  Write-Host "Report written: docs\$reportName. Tell Claude: '$Task finished'." -ForegroundColor Green
} else {
  Write-Host "WARNING: docs\$reportName was not written - the agent probably stopped early. Check $log, or run opencode interactively and paste the prompt." -ForegroundColor Red
}
