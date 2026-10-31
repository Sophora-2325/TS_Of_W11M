param([Parameter(ValueFromRemainingArguments = $true)][string[]]$AbArgs)
$env:AGENT_BROWSER_SESSION = "pmguide-qa"
$quoted = foreach ($a in $AbArgs) {
  if ($a -match '\s' -and -not ($a -match '^".*"$')) { '"' + $a + '"' } else { $a }
}
$id = [guid]::NewGuid().ToString("N")
$out = Join-Path $env:TEMP "ab_$id.txt"
$line = "agent-browser " + ($quoted -join " ")
cmd /c "$line > `"$out`" 2>&1"
$code = $LASTEXITCODE
if (Test-Path $out) {
  $t = Get-Content $out -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
  if ($t) { $t.TrimEnd() }
}
if ($code -ne 0) { "[exit code: $code]" }
