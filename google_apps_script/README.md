# Google Sheets 연결

1. 새 Google Sheet를 만들고 이름을 `REP:ORT 비공개 테스트 신청`으로 지정합니다.
2. **확장 프로그램 → Apps Script**를 열어 `Code.gs` 전체를 붙여 넣습니다.
3. `setup` 함수를 한 번 실행하고 요청되는 권한을 승인합니다.
4. **배포 → 새 배포 → 웹 앱**을 선택합니다.
   - 실행 사용자: 나
   - 액세스 권한: 모든 사용자
5. 배포 URL을 `docs/config.js`의 `appsScriptEndpoint`에 넣습니다.

시트에는 이메일 원문이 아니라 RSA-OAEP 암호문만 기록됩니다. 복호화할 때는 시트를 CSV로 내려받고 `tools/decrypt-tester-emails.ps1`을 사용합니다.

