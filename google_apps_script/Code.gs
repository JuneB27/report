const SHEET_NAME = "TesterRequests";

function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Google Sheet의 확장 프로그램 > Apps Script에서 실행해 주세요.");

  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", spreadsheet.getId());
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["received_at", "version", "algorithm", "ciphertext", "source"]);
    sheet.setFrozenRows(1);
  }
}

function doGet() {
  return jsonResponse_({ ok: true, service: "REPORT tester application" });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
    validatePayload_(payload);

    const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    if (!spreadsheetId) throw new Error("setup()을 먼저 실행해 주세요.");
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("신청 시트를 찾을 수 없습니다.");

    sheet.appendRow([
      new Date(),
      Number(payload.version),
      payload.algorithm,
      payload.ciphertext,
      payload.source || "unknown"
    ]);
    return jsonResponse_({ ok: true });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error && error.message || error) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function validatePayload_(payload) {
  if (Number(payload.version) !== 1) throw new Error("지원하지 않는 요청 버전입니다.");
  if (payload.algorithm !== "RSA-OAEP-256") throw new Error("지원하지 않는 암호화 방식입니다.");
  if (typeof payload.ciphertext !== "string" || payload.ciphertext.length < 300 || payload.ciphertext.length > 1200) {
    throw new Error("암호문 형식이 올바르지 않습니다.");
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload.ciphertext)) throw new Error("암호문 인코딩이 올바르지 않습니다.");
  if (payload.source && String(payload.source).length > 80) throw new Error("source 값이 너무 깁니다.");
}

function jsonResponse_(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

