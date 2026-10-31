$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9225'
$auditNative=Start-Process -FilePath 'D:\STOR\src-tauri\target\release\stor.exe' -WindowStyle Hidden -PassThru
Start-Sleep -Milliseconds 1000
Get-Process -Id $auditNative.Id | Select-Object Id, Path | ConvertTo-Json | Tee-Object -FilePath D:\STOR\audit\evidence\fix-test-process.json
