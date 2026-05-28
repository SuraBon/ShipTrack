function setupApiKey(value) {
  if (!value) {
    throw new Error("Missing API key value");
  }
  PropertiesService.getScriptProperties().setProperty(API_KEY_PROPERTY, String(value).trim());
}

function setupInitialAdminPin(value) {
  const pin = sanitizePassword(value);
  if (!validatePassword(pin) || pin.length > 100) {
    throw new Error("Admin PIN must be 4-100 allowed characters and must not start with = + - or @");
  }
  PropertiesService.getScriptProperties().setProperty(ADMIN_INITIAL_PIN_PROPERTY, pin);
  return { success: true };
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateToken(employeeId, role, secret, issuedAt) {
  const finalIssuedAt = issuedAt || Date.now();
  const sessionId = createSessionId(employeeId);
  setActiveSessionId(employeeId, sessionId);
  const payloadStr = employeeId + "|" + role + "|" + finalIssuedAt + "|" + sessionId;
  const signatureBytes = Utilities.computeHmacSha256Signature(payloadStr, secret);
  const signature = Utilities.base64Encode(signatureBytes);
  return payloadStr + "|" + signature;
}

function createSessionId(employeeId) {
  const random = Utilities.getUuid();
  const issuedAt = Date.now();
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    normalizeEmployeeId(employeeId) + "|" + issuedAt + "|" + random
  );
  return Utilities.base64EncodeWebSafe(bytes).slice(0, 48);
}

function getActiveSessionId(employeeId) {
  const key = "active_session_" + normalizeEmployeeId(employeeId);
  return PropertiesService.getScriptProperties().getProperty(key) || "";
}

function setActiveSessionId(employeeId, sessionId) {
  const key = "active_session_" + normalizeEmployeeId(employeeId);
  PropertiesService.getScriptProperties().setProperty(key, String(sessionId || ""));
}

// ── Audit Log ─────────────────────────────────────────────────────────────────
function writeAuditLog(actorId, action, targetId, details) {
  try {
    const ss = getSpreadsheet();
    let auditSheet = ss.getSheetByName("AuditLog");
    if (!auditSheet) {
      auditSheet = ss.insertSheet("AuditLog");
      auditSheet.appendRow(["Timestamp", "ActorID", "Action", "TargetID", "Details"]);
      auditSheet.getRange("A1:E1").setFontWeight("bold").setBackground("#fef3c7");
    }
    auditSheet.appendRow([
      formatThaiDateForSheet(new Date()),
      escapeSheetValue(actorId || ""),
      escapeSheetValue(action || ""),
      escapeSheetValue(targetId || ""),
      escapeSheetValue(details || "")
    ]);
  } catch (e) {
    // Audit log failure should not block the main operation
  }
}

// ── PIN Brute Force Protection ────────────────────────────────────────────────
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// Write rate limit: max 30 creates per user per 10 minutes
const MAX_WRITE_PER_WINDOW = 30;
const WRITE_WINDOW_SECONDS = 600; // 10 minutes
const IDEMPOTENT_ACTIONS = ["createParcel", "confirmReceipt", "batchConfirmReceipt", "startDelivery", "batchStartDelivery", "releaseDelivery", "syncRouteSamples"];
const IDEMPOTENCY_TTL_SECONDS = 21600; // 6 hours

function getIdempotencyCacheKey(action, payload) {
  if (IDEMPOTENT_ACTIONS.indexOf(action) === -1) return "";
  const rawKey = sanitizeText(payload.idempotencyKey || "");
  if (!rawKey || rawKey.length > 180) return "";
  const actor = normalizeEmployeeId(payload.employeeId || payload.clientId || "guest");
  const digest = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, action + "|" + actor + "|" + rawKey)
  ).slice(0, 80);
  return "idempotency_" + digest;
}

function getCachedIdempotentResponse(action, payload) {
  const key = getIdempotencyCacheKey(action, payload);
  if (!key) return null;
  const cached = CacheService.getScriptCache().get(key);
  if (!cached) return null;
  try {
    return createJsonResponse(JSON.parse(cached));
  } catch {
    return null;
  }
}

function storeIdempotentResponse(action, payload, result) {
  const key = getIdempotencyCacheKey(action, payload);
  if (!key || !result || typeof result.getContent !== "function") return;
  try {
    const data = JSON.parse(result.getContent());
    if (data && data.success === true) {
      CacheService.getScriptCache().put(key, JSON.stringify(data), IDEMPOTENCY_TTL_SECONDS);
    }
  } catch {
    // Idempotency cache failure should not block the operation.
  }
}

function checkWriteRateLimit(employeeId, action) {
  const cache = CacheService.getScriptCache();
  const key = "write_rate_" + sanitizeText(action) + "_" + normalizeEmployeeId(employeeId);
  const raw = cache.get(key);
  let count = 0;
  try { if (raw) count = parseInt(raw) || 0; } catch { }
  if (count >= MAX_WRITE_PER_WINDOW) {
    return { allowed: false };
  }
  cache.put(key, String(count + 1), WRITE_WINDOW_SECONDS);
  return { allowed: true };
}

function checkLoginRateLimit(employeeId) {
  const cache = CacheService.getScriptCache();
  const key = "login_attempts_" + normalizeEmployeeId(employeeId);
  const raw = cache.get(key);
  if (!raw) return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS };
  try {
    const data = JSON.parse(raw);
    if (data.lockedUntil && Date.now() < data.lockedUntil) {
      const minutesLeft = Math.ceil((data.lockedUntil - Date.now()) / 60000);
      return { allowed: false, remaining: 0, minutesLeft };
    }
    return { allowed: true, remaining: Math.max(0, MAX_LOGIN_ATTEMPTS - (data.count || 0)) };
  } catch {
    return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS };
  }
}

function recordFailedLogin(employeeId) {
  const cache = CacheService.getScriptCache();
  const key = "login_attempts_" + normalizeEmployeeId(employeeId);
  const raw = cache.get(key);
  let data = { count: 0, lockedUntil: null };
  try { if (raw) data = JSON.parse(raw); } catch { }
  data.count = (data.count || 0) + 1;
  if (data.count >= MAX_LOGIN_ATTEMPTS) {
    data.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
  }
  // Store for 20 minutes
  cache.put(key, JSON.stringify(data), 1200);
}

function clearLoginAttempts(employeeId) {
  const cache = CacheService.getScriptCache();
  cache.remove("login_attempts_" + normalizeEmployeeId(employeeId));
}

// --- RBAC & Users ---

function handleLogin(payload) {
  const employeeId = normalizeEmployeeId(payload.employeeId);
  const pin = sanitizePassword(payload.pin);
  if (!employeeId) return createJsonResponse({ success: false, error: "กรุณาระบุรหัสพนักงาน" });

  // Validate employeeId format (A-Z, 0-9 only, max 50 chars)
  if (!validateEmployeeId(employeeId)) {
    return createJsonResponse({ success: false, error: "รหัสพนักงานไม่ถูกต้อง" });
  }

  // Rate limit check
  const rateLimit = checkLoginRateLimit(employeeId);
  if (!rateLimit.allowed) {
    writeAuditLog(employeeId, "LOGIN_BLOCKED", employeeId, "Too many failed attempts, locked for " + rateLimit.minutesLeft + " minutes");
    return createJsonResponse({ success: false, error: "บัญชีถูกล็อคชั่วคราว กรุณาลองใหม่ใน " + rateLimit.minutesLeft + " นาที" });
  }

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (normalizeEmployeeId(data[i][0]) === employeeId) {
      const storedPin = String(data[i][3] || "").trim();
      const role = normalizeRole(data[i][2] || "GUEST");
      const status = String(data[i][5] || "ACTIVE").trim().toUpperCase() || "ACTIVE";
      if (status === "DISABLED") {
        return createJsonResponse({ success: false, error: "บัญชีนี้ถูกปิดใช้งาน" });
      }
      if (role === "GUEST") {
        return createJsonResponse({ success: false, error: "บัญชีนี้ไม่มีสิทธิ์เข้าสู่ระบบพนักงาน" });
      }
      const name = String(data[i][1]).trim();

      if (!storedPin) {
        return createJsonResponse({ success: true, needsSetup: true, role, name });
      }

      const passwordCheck = verifyPasswordRecord(storedPin, pin);
      if (!passwordCheck.ok) {
        recordFailedLogin(employeeId);
        const remaining = rateLimit.remaining - 1;
        const msg = remaining > 0
          ? "รหัสผ่านไม่ถูกต้อง (เหลือ " + remaining + " ครั้ง)"
          : "รหัสผ่านไม่ถูกต้อง บัญชีจะถูกล็อค";
        return createJsonResponse({ success: false, error: msg });
      }

      if (passwordCheck.needsMigration) {
        sheet.getRange(i + 1, 4).setValue(encodePassword(pin));
      }
      clearLoginAttempts(employeeId);
      const issuedAt = Date.now();
      const token = generateToken(employeeId, role, getApiKey(), issuedAt);
      return createJsonResponse({ success: true, user: { employeeId, name, role, token, issuedAt } });
    }
  }

  // User not found — do NOT auto-create; require registration via setupPin
  return createJsonResponse({ success: false, error: "ไม่พบรหัสพนักงานนี้ในระบบ กรุณาให้ผู้ดูแลระบบเพิ่มบัญชีก่อน" });
}

function handleSetupPin(payload) {
  const employeeId = normalizeEmployeeId(payload.employeeId);
  const pin = sanitizePassword(payload.pin);
  const name = escapeSheetValue(payload.name || "");

  if (!employeeId || !pin) return createJsonResponse({ success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  if (!validateEmployeeId(employeeId)) return createJsonResponse({ success: false, error: "รหัสพนักงานไม่ถูกต้อง" });
  if (!validatePassword(pin) || pin.length > 20) return createJsonResponse({ success: false, error: "รหัสผ่านต้องมี 4-20 ตัวอักษร และห้ามขึ้นต้นด้วย = + - หรือ @" });
  if (name && name.length > 100) return createJsonResponse({ success: false, error: "ชื่อยาวเกินไป" });

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (normalizeEmployeeId(data[i][0]) === employeeId) {
      const storedPin = String(data[i][3] || "").trim();
      const status = String(data[i][5] || "ACTIVE").trim().toUpperCase() || "ACTIVE";
      if (status === "DISABLED") {
        return createJsonResponse({ success: false, error: "บัญชีนี้ถูกปิดใช้งาน" });
      }
      if (storedPin) {
        return createJsonResponse({ success: false, error: "รหัสพนักงานนี้มีผู้ใช้งานแล้ว" });
      }
      if (name) sheet.getRange(i + 1, 2).setValue(name);
      sheet.getRange(i + 1, 4).setValue(encodePassword(pin));
      sheet.getRange(i + 1, 6).setValue("ACTIVE");
      sheet.getRange(i + 1, 7).setValue(formatThaiDateForSheet(new Date()));

      const role = normalizeRole(data[i][2] || "GUEST");
      if (role === "GUEST") {
        return createJsonResponse({ success: false, error: "บัญชีนี้ไม่มีสิทธิ์ตั้งค่าการเข้าใช้งานพนักงาน" });
      }
      const finalName = name || String(data[i][1]).trim();

      const issuedAt = Date.now();
      const token = generateToken(employeeId, role, getApiKey(), issuedAt);
      return createJsonResponse({ success: true, user: { employeeId, name: finalName, role, token, issuedAt } });
    }
  }

  return createJsonResponse({ success: false, error: "ไม่พบรหัสพนักงานนี้ในระบบ กรุณาให้ผู้ดูแลระบบเพิ่มบัญชีก่อน" });
}
