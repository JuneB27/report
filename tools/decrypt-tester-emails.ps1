param(
  [Parameter(Mandatory = $true)][string]$CsvPath,
  [string]$PrivateKeyPath = (Join-Path $PSScriptRoot "..\private_keys\report-tester-private-key.pem"),
  [string]$OutputPath = (Join-Path (Split-Path -Parent $CsvPath) "REPORT_testers_decrypted.csv")
)

$ErrorActionPreference = "Stop"
if (!(Test-Path $CsvPath)) { throw "CSV 파일을 찾을 수 없습니다: $CsvPath" }
if (!(Test-Path $PrivateKeyPath)) { throw "개인키를 찾을 수 없습니다: $PrivateKeyPath" }

$rsa = [System.Security.Cryptography.RSA]::Create()
try {
  $rsa.ImportFromPem([IO.File]::ReadAllText($PrivateKeyPath))
  $result = foreach ($row in (Import-Csv $CsvPath)) {
    try {
      $cipherBytes = [Convert]::FromBase64String($row.ciphertext)
      $plainBytes = $rsa.Decrypt($cipherBytes, [System.Security.Cryptography.RSAEncryptionPadding]::OaepSHA256)
      $payload = [Text.Encoding]::UTF8.GetString($plainBytes) | ConvertFrom-Json
      [pscustomobject]@{
        received_at = $row.received_at
        email = $payload.email
        consent_at = $payload.consentAt
        purpose = $payload.purpose
      }
    } catch {
      [pscustomobject]@{
        received_at = $row.received_at
        email = "[DECRYPTION_FAILED]"
        consent_at = ""
        purpose = ""
      }
    }
  }
  $result | Export-Csv -Path $OutputPath -NoTypeInformation -Encoding utf8
} finally {
  $rsa.Dispose()
}

Write-Host "복호화 결과를 저장했습니다: $OutputPath"
