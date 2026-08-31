param(
  [string]$PrivateKeyPath = (Join-Path $PSScriptRoot "..\private_keys\report-tester-private-key.pem"),
  [string]$PublicKeyPath = (Join-Path $PSScriptRoot "..\private_keys\report-tester-public-key.pem")
)

$ErrorActionPreference = "Stop"
$testEmail = "tester@example.com"
$rsaPublic = [System.Security.Cryptography.RSA]::Create()
$rsaPrivate = [System.Security.Cryptography.RSA]::Create()
try {
  $rsaPublic.ImportFromPem([IO.File]::ReadAllText($PublicKeyPath))
  $rsaPrivate.ImportFromPem([IO.File]::ReadAllText($PrivateKeyPath))
  $payload = [ordered]@{
    email = $testEmail
    consentAt = "2026-01-01T00:00:00.000Z"
    purpose = "REPORT_ANDROID_CLOSED_TEST"
  } | ConvertTo-Json -Compress
  $ciphertext = $rsaPublic.Encrypt(
    [Text.Encoding]::UTF8.GetBytes($payload),
    [System.Security.Cryptography.RSAEncryptionPadding]::OaepSHA256
  )
  $decrypted = $rsaPrivate.Decrypt(
    $ciphertext,
    [System.Security.Cryptography.RSAEncryptionPadding]::OaepSHA256
  )
  $result = [Text.Encoding]::UTF8.GetString($decrypted) | ConvertFrom-Json
  if ($result.email -ne $testEmail) { throw "RSA-OAEP 왕복 검증에 실패했습니다." }
  Write-Host "RSA-OAEP-256 암호화/복호화 검증을 통과했습니다."
} finally {
  $rsaPublic.Dispose()
  $rsaPrivate.Dispose()
}
