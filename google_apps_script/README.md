# Google Sheets 연결

1. 새 Google Sheet를 만들고 이름을 `REP:ORT 비공개 테스트 신청`으로 지정합니다.
2. **확장 프로그램 → Apps Script**를 열어 `Code.gs` 전체를 붙여 넣습니다.
3. `setup` 함수를 한 번 실행하고 요청되는 권한을 승인합니다.
4. **배포 → 새 배포 → 웹 앱**을 선택합니다.
   - 실행 사용자: 나
   - 액세스 권한: 모든 사용자
5. 배포 URL을 `docs/config.js`의 `appsScriptEndpoint`에 넣습니다.

시트에는 이메일 원문이 아니라 RSA-OAEP 암호문만 기록됩니다. 복호화할 때는 시트를 CSV로 내려받고 `tools/decrypt-tester-emails.ps1`을 사용합니다.

## 초대 완료 표시

- `setup`을 다시 한 번 실행하면 `TesterRequests` 시트의 마지막 열에 `complete`가 자동으로 추가됩니다.
- Google Play 초대를 처리한 마지막 신청 행의 `complete` 셀에 `complete`를 입력합니다. 대소문자와 앞뒤 공백은 구분하지 않습니다.
- 페이지는 그 행의 `received_at` 시각까지만 공개 상태 API로 읽습니다. 이메일과 암호문은 반환하지 않습니다.
- 같은 기기에서 신청한 시각이 완료 기준 시각 이전이면 모집 페이지 마지막에 **테스트 초대가 완료되었습니다** 카드와 Google Play 설치 카드가 나타납니다.
- Apps Script 코드를 수정한 뒤에는 기존 웹 앱 배포를 새 버전으로 업데이트해야 합니다. URL은 그대로 유지할 수 있습니다.
