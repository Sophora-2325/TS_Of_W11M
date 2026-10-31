$s = "D:\STOR\.cache\pm-guide-review\shots\qa"
$ab = Join-Path $s "ab.ps1"
$sc = Join-Path $s "abscroll.ps1"
$abe = Join-Path $s "abe.ps1"
$topJs = Join-Path $s "js\scrolltop.js"
Set-Content -Path $topJs -Value "window.scrollTo({top:0,behavior:'instant'}); 'top'" -Encoding UTF8
function Shot($name) { & $ab screenshot (Join-Path $s "$name.png") | Out-Null }
$cases = @(
  @{ name = "ch2-wishes";    sel = "#wishes";        off = 80 },
  @{ name = "ch4-usage";     sel = "#usage";         off = 80 },
  @{ name = "ch5-limits";    sel = "#limits";        off = 80 },
  @{ name = "ch6-scope";     sel = "#scope";         off = 80 },
  @{ name = "ch7-metrics";   sel = "#metrics";       off = 80 },
  @{ name = "ch7-calc";      sel = "#metrics .calc"; off = 90 },
  @{ name = "ch8-gates";     sel = "#gates";         off = 80 },
  @{ name = "quiz";          sel = "#quiz";          off = 80 }
)
foreach ($vp in @(@(1440,1000), @(1024,900), @(768,1024), @(390,844))) {
  $w = $vp[0]; $h = $vp[1]
  & $ab set viewport $w $h | Out-Null
  & $abe $topJs | Out-Null
  & $ab wait 500 | Out-Null
  Shot "$w-hero"
  foreach ($c in $cases) {
    & $sc $c.sel $c.off 300 | Out-Null
    & $ab wait 250 | Out-Null
    Shot "$w-$($c.name)"
  }
  # footer: scroll to bottom
  $tmp = Join-Path $env:TEMP "foot_$w.js"
  Set-Content -Path $tmp -Value "window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}); 'bottom'" -Encoding UTF8
  & $abe $tmp | Out-Null
  & $ab wait 300 | Out-Null
  Shot "$w-footer"
}
"done"
Get-ChildItem $s -Filter "*.png" | Where-Object { $_.Length -lt 60000 } | Select-Object Name,Length | Format-Table -AutoSize
