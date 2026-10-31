param([string]$Selector, [int]$Offset = 80, [int]$WaitMs = 450)
$q = (ConvertTo-Json $Selector -Compress)
$js = @"
(() => {
  const el = document.querySelector($q);
  if (!el) return 'not-found: ' + $q;
  const y = el.getBoundingClientRect().top + window.scrollY - $Offset;
  window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
  return JSON.stringify({ selector: $q, scrollY: Math.round(window.scrollY), elTop: Math.round(el.getBoundingClientRect().top) });
})()
"@
$tmp = Join-Path $env:TEMP ("abscroll_" + [guid]::NewGuid().ToString("N") + ".js")
Set-Content -Path $tmp -Value $js -Encoding UTF8
& "D:\STOR\.cache\pm-guide-review\shots\qa\abe.ps1" $tmp
if ($WaitMs -gt 0) { Start-Sleep -Milliseconds $WaitMs }
