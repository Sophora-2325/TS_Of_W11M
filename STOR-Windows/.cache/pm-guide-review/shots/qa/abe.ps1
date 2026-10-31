param([string]$JsFile)
$env:AGENT_BROWSER_SESSION = "pmguide-qa"
$js = Get-Content $JsFile -Raw -Encoding UTF8
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($js))
$id = [guid]::NewGuid().ToString("N")
$out = Join-Path $env:TEMP "ab_$id.txt"
cmd /c "agent-browser eval -b $b64 > `"$out`" 2>&1"
$code = $LASTEXITCODE
if (Test-Path $out) {
  $t = Get-Content $out -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
  if ($t) { $t.TrimEnd() }
}
if ($code -ne 0) { "[exit code: $code]" }
