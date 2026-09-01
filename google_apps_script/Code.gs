const SHEET_NAME = "TesterRequests";
// F열 complete를 유지하고, 사람이 직접 확인할 초대코드는 G열에 추가합니다.
const HEADERS = ["received_at", "version", "algorithm", "ciphertext", "source", "complete", "invite_code"];
const COMPLETE_VALUE = "complete";

function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Google Sheet의 확장 프로그램 > Apps Script에서 실행해 주세요.");

  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", spreadsheet.getId());
  const sheet = getOrCreateSheet_(spreadsheet);
  ensureSheetColumns_(sheet);
}

function doGet(e) {
  try {
    const action = String(e && e.parameter && e.parameter.action || "health");
    if (action === "invite-status") return response_(getInviteStatus_(), e);
    return response_({ ok: true, service: "REPORT tester application" }, e);
  } catch (error) {
    return response_({ ok: false, error: String(error && error.message || error) }, e);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
    validatePayload_(payload);

    const sheet = getConfiguredSheet_();
    const headers = ensureSheetColumns_(sheet);
    const values = {
      received_at: new Date(),
      version: Number(payload.version),
      algorithm: payload.algorithm,
      ciphertext: payload.ciphertext,
      source: normalizeSource_(payload.source),
      complete: "",
      invite_code: protectSheetText_(payload.inviteCode)
    };

    sheet.appendRow(headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(values, header) ? values[header] : "";
    }));
    return response_({ ok: true }, e);
  } catch (error) {
    return response_({ ok: false, error: String(error && error.message || error) }, e);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function getInviteStatus_() {
  const sheet = getConfiguredSheet_();
  const headers = ensureSheetColumns_(sheet);
  const receivedAtColumn = headers.indexOf("received_at") + 1;
  const completeColumn = headers.indexOf("complete") + 1;
  const rowCount = Math.max(0, sheet.getLastRow() - 1);

  if (!rowCount || !receivedAtColumn || !completeColumn) {
    return { ok: true, completeThrough: null };
  }

  const receivedValues = sheet.getRange(2, receivedAtColumn, rowCount, 1).getValues();
  const completeValues = sheet.getRange(2, completeColumn, rowCount, 1).getDisplayValues();
  let latestCompletedAt = null;

  for (let index = 0; index < rowCount; index += 1) {
    const marker = String(completeValues[index][0] || "").trim().toLowerCase();
    if (marker !== COMPLETE_VALUE) continue;

    const receivedAt = receivedValues[index][0];
    const parsed = receivedAt instanceof Date ? receivedAt : new Date(receivedAt);
    if (Number.isNaN(parsed.getTime())) continue;
    if (!latestCompletedAt || parsed > latestCompletedAt) latestCompletedAt = parsed;
  }

  return {
    ok: true,
    completeThrough: latestCompletedAt ? latestCompletedAt.toISOString() : null
  };
}

function getConfiguredSheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!spreadsheetId) throw new Error("setup()을 먼저 실행해 주세요.");
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  return getOrCreateSheet_(spreadsheet);
}

function getOrCreateSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  return sheet;
}

function ensureSheetColumns_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    return HEADERS.slice();
  }

  let lastColumn = Math.max(1, sheet.getLastColumn());
  let headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map(function (value) { return String(value || "").trim(); });

  HEADERS.forEach(function (requiredHeader) {
    if (headers.indexOf(requiredHeader) !== -1) return;
    lastColumn += 1;
    sheet.getRange(1, lastColumn).setValue(requiredHeader);
    headers.push(requiredHeader);
  });
  sheet.setFrozenRows(1);
  return headers;
}

function validatePayload_(payload) {
  if (Number(payload.version) !== 1) throw new Error("지원하지 않는 요청 버전입니다.");
  if (payload.algorithm !== "RSA-OAEP-256") throw new Error("지원하지 않는 암호화 방식입니다.");
  if (typeof payload.ciphertext !== "string" || payload.ciphertext.length < 300 || payload.ciphertext.length > 1200) {
    throw new Error("암호문 형식이 올바르지 않습니다.");
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload.ciphertext)) throw new Error("암호문 인코딩이 올바르지 않습니다.");
  if (payload.source && String(payload.source).length > 80) throw new Error("source 값이 너무 깁니다.");
  if (payload.inviteCode !== undefined && payload.inviteCode !== null) {
    const inviteCode = String(payload.inviteCode).trim();
    if (!inviteCode || inviteCode.length > 40 || /[\r\n\t]/.test(inviteCode)) {
      throw new Error("초대코드 형식이 올바르지 않습니다.");
    }
  }
}

function normalizeSource_(value) {
  return String(value || "unknown").replace(/\s+\|\s+invite:[\s\S]*$/, "").slice(0, 80);
}

function protectSheetText_(value) {
  const text = String(value || "").trim();
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function response_(body, e) {
  const callback = String(e && e.parameter && e.parameter.callback || "");
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$.]{0,80}$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + JSON.stringify(body) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
