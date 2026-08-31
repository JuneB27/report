param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\private_keys")
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$privatePath = Join-Path $OutputDirectory "report-tester-private-key.pem"
$publicPath = Join-Path $OutputDirectory "report-tester-public-key.pem"
$jwkPath = Join-Path $OutputDirectory "report-tester-public-key.jwk.json"

if (Test-Path $privatePath) {
  throw "개인키가 이미 있습니다: $privatePath`n기존 키를 덮어쓰지 않았습니다."
}

$rsa = [System.Security.Cryptography.RSA]::Create(3072)
try {
  $privateBytes = $rsa.ExportPkcs8PrivateKey()
  $publicBytes = $rsa.ExportSubjectPublicKeyInfo()
  $parameters = $rsa.ExportParameters($false)

  function To-Pem([string]$Label, [byte[]]$Bytes) {
    $base64 = [Convert]::ToBase64String($Bytes)
    $lines = for ($i = 0; $i -lt $base64.Length; $i += 64) {
      $base64.Substring($i, [Math]::Min(64, $base64.Length - $i))
    }
    "-----BEGIN $Label-----`n$($lines -join "`n")`n-----END $Label-----`n"
  }

  function To-Base64Url([byte[]]$Bytes) {
    [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  }

  [IO.File]::WriteAllText($privatePath, (To-Pem "PRIVATE KEY" $privateBytes), [Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText($publicPath, (To-Pem "PUBLIC KEY" $publicBytes), [Text.UTF8Encoding]::new($false))
  $jwk = [ordered]@{
    kty = "RSA"
    alg = "RSA-OAEP-256"
    e = To-Base64Url $parameters.Exponent
    n = To-Base64Url $parameters.Modulus
    key_ops = @("encrypt")
    ext = $true
  }
  $jwk | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 $jwkPath
} finally {
  $rsa.Dispose()
}

Write-Host "RSA 3072-bit 키를 생성했습니다."
Write-Host "개인키: $privatePath"
Write-Host "공개 JWK: $jwkPath"
Write-Warning "개인키를 암호화된 별도 저장소에 백업하세요. 분실하면 신청 이메일을 복구할 수 없습니다."
