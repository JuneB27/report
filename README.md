# REP:ORT private test

운동을 사진으로 인증하고 서로의 꾸준함을 응원하는 피트니스 커뮤니티 **REP:ORT**의 비공개 테스트 모집 페이지입니다.

## 포함된 구성

- `docs/`: GitHub Pages용 테스트 모집 페이지
- `google_apps_script/`: 암호화된 신청 데이터를 Google Sheets에 적재하는 Apps Script
- `tools/`: RSA 키 생성 및 신청 이메일 복호화 도구

## 개인정보 보호 방식

이메일은 신청자의 브라우저에서 RSA-OAEP(SHA-256) 공개키로 암호화됩니다. Google Sheets에는 암호문과 접수 시각만 저장되며, 저장소나 Apps Script에는 복호화 개인키가 들어가지 않습니다.

개인키는 `private_keys/report-tester-private-key.pem`에만 생성됩니다. 이 파일을 잃으면 신청 이메일을 복구할 수 없으므로 암호화된 별도 저장소에 백업해야 합니다.

## 설치 순서

1. `tools/generate-rsa-key.ps1`을 실행합니다.
2. 출력된 공개 JWK를 `docs/config.js`의 `emailPublicKeyJwk`에 넣습니다.
3. Google Sheet의 Apps Script에 `google_apps_script/Code.gs`를 붙여 넣고 `setup()`을 한 번 실행합니다.
4. 웹 앱을 배포한 뒤 URL을 `docs/config.js`의 `appsScriptEndpoint`에 넣습니다.
5. Kakao Developers에 `https://juneb27.github.io`를 웹/JavaScript SDK 도메인으로 등록하고 JavaScript 키를 `docs/config.js`에 넣습니다.
6. GitHub Pages의 배포 원본을 `main /docs`로 설정합니다.

`docs/config.js`에 들어가는 공개키·배포 URL·Kakao JavaScript 키는 브라우저에 공개되는 설정입니다. Kakao JavaScript 키는 비밀번호가 아닌 클라이언트 식별자이지만, Kakao Developers에서 허용 도메인을 반드시 `https://juneb27.github.io`로 제한해야 합니다.
