param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$serviceRoot = Join-Path $taskRoot 'ocr-service'
$taskPython = Join-Path $serviceRoot '.venv\Scripts\python.exe'
Push-Location $taskRoot
try {
    if (-not $SkipInstall) {
        if (-not (Test-Path -LiteralPath $taskPython)) {
            & uv --cache-dir "$taskRoot\.cache\uv" venv --python 3.12 "$serviceRoot\.venv"
            if ($LASTEXITCODE -ne 0) { throw 'Cannot create OCR build environment' }
        }
        & uv --cache-dir "$taskRoot\.cache\uv" pip sync --python $taskPython "$serviceRoot\requirements.lock"
        if ($LASTEXITCODE -ne 0) { throw 'Cannot install OCR build dependencies' }
    }
    & $taskPython "$serviceRoot\fetch_models.py"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot prepare official OCR models' }
    $env:PYINSTALLER_CONFIG_DIR = "$taskRoot\.cache\pyinstaller"
    & $taskPython -m PyInstaller --noconfirm --clean `
        --distpath "$serviceRoot\build\dist" --workpath "$serviceRoot\build\work" "$serviceRoot\stor-ocr.spec"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot package OCR worker' }
    $runtimeRoot = Join-Path $taskRoot 'src-tauri\resources\ocr'
    if (Test-Path -LiteralPath $runtimeRoot) {
        $resolvedRuntime = (Resolve-Path -LiteralPath $runtimeRoot).Path
        $expectedRuntime = [IO.Path]::GetFullPath((Join-Path $taskRoot 'src-tauri\resources\ocr'))
        if ($resolvedRuntime -ne $expectedRuntime -or -not $resolvedRuntime.StartsWith($taskRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Refusing to replace OCR runtime outside the workspace resource directory'
        }
        Remove-Item -LiteralPath $resolvedRuntime -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
    Copy-Item -Path "$serviceRoot\build\dist\stor-ocr\*" -Destination $runtimeRoot -Recurse -Force
    Copy-Item -LiteralPath "$serviceRoot\models" -Destination $runtimeRoot -Recurse -Force
    Copy-Item -LiteralPath "$serviceRoot\NOTICE.md" -Destination $runtimeRoot -Force
    & $taskPython "$serviceRoot\collect_licenses.py" "$runtimeRoot\licenses"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot collect dependency licenses' }
    $sourceHashes = [ordered]@{}
    foreach ($sourceFile in 'worker.py','requirements.lock','stor-ocr.spec','model-sources.json') {
        $sourceHashes[$sourceFile] = (Get-FileHash -LiteralPath "$serviceRoot\$sourceFile" -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    # Windows PowerShell writes a BOM with UTF8; use .NET to write portable UTF-8 JSON.
    $stamp = @{ sources = $sourceHashes } | ConvertTo-Json -Depth 3
    [IO.File]::WriteAllText("$runtimeRoot\build-info.json", $stamp, (New-Object Text.UTF8Encoding $false))
    Write-Host "OCR runtime ready: $runtimeRoot"
} finally {
    Pop-Location
}
