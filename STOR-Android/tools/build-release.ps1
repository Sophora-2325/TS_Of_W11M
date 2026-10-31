param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$JavaHome = 'D:\Android Studio\jbr',
    [string]$AndroidSdk = (Join-Path $env:LOCALAPPDATA 'Android\Sdk'),
    [switch]$InitializeSigning
)
$ErrorActionPreference = 'Stop'
$taskKeyDirectory = Join-Path $ProjectRoot '.signing'
$taskKey = Join-Path $taskKeyDirectory 'stor-release.p12'
$taskPasswordFile = Join-Path $taskKeyDirectory 'signing-password.txt'
$taskJava = Join-Path $JavaHome 'bin\java.exe'
$taskSigner = Join-Path $AndroidSdk 'build-tools\36.0.0\lib\apksigner.jar'
$taskAlias = 'stor-release'
if ($InitializeSigning) {
    if ((Test-Path -LiteralPath $taskKey) -or (Test-Path -LiteralPath $taskPasswordFile)) {
        throw '签名资料已存在，不会替换。再次构建请省略 -InitializeSigning。'
    }
    New-Item -ItemType Directory -Force -Path $taskKeyDirectory | Out-Null
    $env:STOR_RELEASE_PASSWORD = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    try {
        & (Join-Path $JavaHome 'bin\keytool.exe') -genkeypair -keystore $taskKey -storetype PKCS12 -alias $taskAlias -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=STOR Android Release, O=STOR, C=CN' -storepass:env STOR_RELEASE_PASSWORD -keypass:env STOR_RELEASE_PASSWORD -noprompt
        if ($LASTEXITCODE -ne 0) { throw '创建签名密钥失败' }
        # Private local recovery material. This directory is excluded from Git and source sync.
        [IO.File]::WriteAllText($taskPasswordFile, $env:STOR_RELEASE_PASSWORD)
    } finally { Remove-Item Env:STOR_RELEASE_PASSWORD }
}
if (-not (Test-Path -LiteralPath $taskKey) -or -not (Test-Path -LiteralPath $taskPasswordFile)) {
    throw '缺少签名资料；首次创建使用 -InitializeSigning，已有项目应恢复原密钥和密码文件。'
}
$env:JAVA_HOME = $JavaHome
& (Join-Path $ProjectRoot 'gradlew.bat') -p $ProjectRoot --no-daemon :app:assembleRelease --console=plain
if ($LASTEXITCODE -ne 0) { throw 'release 构建失败' }
$taskApkDirectory = Join-Path $ProjectRoot 'app\build\outputs\apk\release'
$taskMetadata = Get-Content -Raw (Join-Path $taskApkDirectory 'output-metadata.json') | ConvertFrom-Json
$taskVersion = $taskMetadata.elements[0].versionName
$taskOutput = Join-Path $ProjectRoot "releases\$taskVersion"
New-Item -ItemType Directory -Force -Path $taskOutput | Out-Null
$taskSignedApk = Join-Path $taskOutput "Jianyi-$taskVersion-arm64.apk"
$env:STOR_RELEASE_PASSWORD = [IO.File]::ReadAllText($taskPasswordFile)
try {
    & $taskJava -jar $taskSigner sign --ks $taskKey --ks-key-alias $taskAlias --ks-pass env:STOR_RELEASE_PASSWORD --key-pass env:STOR_RELEASE_PASSWORD --v4-signing-enabled false --out $taskSignedApk (Join-Path $taskApkDirectory 'app-release-unsigned.apk')
    if ($LASTEXITCODE -ne 0) { throw 'APK 签名失败' }
    & (Join-Path $JavaHome 'bin\keytool.exe') -exportcert -rfc -keystore $taskKey -alias $taskAlias -storepass:env STOR_RELEASE_PASSWORD -file (Join-Path $taskOutput 'PUBLIC_CERT.pem')
    if ($LASTEXITCODE -ne 0) { throw '导出公开证书失败' }
} finally { Remove-Item Env:STOR_RELEASE_PASSWORD }
& $taskJava -jar $taskSigner verify --verbose --print-certs $taskSignedApk | Tee-Object -FilePath (Join-Path $taskOutput 'SIGNATURE.txt')
if ($LASTEXITCODE -ne 0) { throw 'APK 签名校验失败' }
$taskHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $taskSignedApk).Hash
"$taskHash  $([IO.Path]::GetFileName($taskSignedApk))" | Set-Content (Join-Path $taskOutput 'SHA256SUMS.txt')
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'app\build\outputs\mapping\release\mapping.txt') -Destination (Join-Path $taskOutput 'mapping.txt')
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'THIRD_PARTY_NOTICES.md') -Destination $taskOutput
Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'docs\release') -File -Filter *.md | Copy-Item -Destination $taskOutput
Write-Output "Signed release: $taskSignedApk"
