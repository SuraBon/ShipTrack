function getApiKey() {
  if (apiKeyCache !== null) {
    return apiKeyCache;
  }
  apiKeyCache = PropertiesService.getScriptProperties().getProperty(API_KEY_PROPERTY) || SCRIPT_API_KEY || "";
  return apiKeyCache;
}

function getInitialAdminPin() {
  const props = PropertiesService.getScriptProperties();
  const configured = sanitizePassword(props.getProperty(ADMIN_INITIAL_PIN_PROPERTY) || DEFAULT_ADMIN_PIN);
  if (!configured || !validatePassword(configured) || configured.length > 100) {
    throw new Error("Set Script Property " + ADMIN_INITIAL_PIN_PROPERTY + " before running setup/resetDefaultAdminPassword");
  }
  return configured;
}

function normalizeBranchName(branch) {
  if (!branch) return "";
  const value = String(branch).trim();
  const aliases = {
    "พันธุ์สงคราม": "พิบูลสงคราม",
    "เซ็นทรัลพระราม 2": "เซ็นทรัล พระราม 2",
  };
  return escapeSheetValue(aliases[value] || value);
}

function validateTrackingID(trackingID) {
  return !!trackingID && TRACKING_ID_REGEX.test(String(trackingID).trim());
}

function normalizeEmployeeId(value) {
  return String(value || "").trim().toUpperCase();
}

function validateEmployeeId(value) {
  return EMPLOYEE_ID_REGEX.test(normalizeEmployeeId(value));
}

function sanitizePassword(value) {
  return String(value || "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

function validatePassword(value) {
  const password = sanitizePassword(value);
  return SAFE_PASSWORD_REGEX.test(password) && !/^[=+\-@\t\r]/.test(password);
}

function makePasswordSalt() {
  return Utilities.getUuid().replace(/-/g, "") + String(Date.now());
}

function hashPassword(password, salt) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + "|" + sanitizePassword(password),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(digest);
}

function encodePassword(password) {
  const salt = makePasswordSalt();
  return "sha256$" + salt + "$" + hashPassword(password, salt);
}

function verifyPasswordRecord(storedValue, password) {
  const stored = String(storedValue || "").trim();
  const cleanPassword = sanitizePassword(password);
  if (!stored) return { ok: false, needsMigration: false };

  const parts = stored.split("$");
  if (parts.length === 3 && parts[0] === "sha256") {
    return {
      ok: hashPassword(cleanPassword, parts[1]) === parts[2],
      needsMigration: false
    };
  }

  return {
    ok: stored === cleanPassword,
    needsMigration: stored === cleanPassword
  };
}

// ── Input sanitization ───────────────────────────────────────────────────────

/**
 * Strip HTML tags and control characters from user-supplied text.
 * Prevents XSS if data is ever rendered in a web context.
 */
function sanitizeText(value) {
  if (!value) return '';
  return String(value)
    .replace(/<[^>]*>/g, '')          // strip HTML tags
    .replace(/[<>"'`]/g, '')          // strip remaining dangerous chars
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .trim();
}

function escapeSheetValue(value) {
  const text = sanitizeText(value);
  if (!text) return "";
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function sanitizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length > 2048) return "";
  if (/^https:\/\/(drive\.google\.com|lh3\.googleusercontent\.com)\//i.test(text)) return text;
  return "";
}

function sanitizeCoordinate(value, min, max) {
  if (value === "" || value === null || typeof value === "undefined") return "";
  const num = Number(value);
  if (!isFinite(num) || num < min || num > max) return "";
  return Math.round(num * 10000000) / 10000000;
}

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  if (lat1 === "" || lng1 === "" || lat2 === "" || lng2 === "") return null;
  const aLat = Number(lat1), aLng = Number(lng1), bLat = Number(lat2), bLng = Number(lng2);
  if (!isFinite(aLat) || !isFinite(aLng) || !isFinite(bLat) || !isFinite(bLng)) return null;
  const radius = 6371000;
  const toRad = function (deg) { return deg * Math.PI / 180; };
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sinLng * sinLng;
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function redactParcelForGuest(parcel) {
  const redacted = {};
  [
    "TrackingID",
    "วันที่สร้าง",
    "ผู้ส่ง",
    "สาขาผู้ส่ง",
    "ผู้รับ",
    "สาขาผู้รับ",
    "สถานะ",
    "รูปยืนยัน",
    "วันที่รับ",
    "Latitude",
    "Longitude",
    "OriginLatitude",
    "OriginLongitude"
  ].forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(parcel, key)) redacted[key] = parcel[key];
  });
  return redacted;
}

function canReadParcelRow(payload, row) {
  const role = normalizeRole(payload.role);
  if (role === "ADMIN" || role === "MESSENGER") return true;
  return false;
}

function validateImagePayload(value) {
  const text = String(value || "").trim();
  if (!text) return { ok: false, error: "กรุณาแนบรูปภาพหลักฐาน" };
  if (/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(text)) {
    if (text.length > MAX_BASE64_LENGTH) return { ok: false, error: "ขนาดรูปภาพใหญ่เกินไป" };
    return { ok: true, value: text };
  }
  const url = sanitizeUrl(text);
  if (url) return { ok: true, value: url };
  return { ok: false, error: "รูปภาพหลักฐานไม่ถูกต้อง" };
}

function saveImagePayloadToDrive(imageValue, trackingId) {
  let finalPhotoUrl = String(imageValue || "").trim();
  if (!finalPhotoUrl || !finalPhotoUrl.startsWith('data:image')) return finalPhotoUrl;

  // ค้นหาหรือสร้างโฟลเดอร์หลักชื่อ ShipTrack_Images
  const systemFolder = getShipTrackFolder();
  let rootFolder;
  const rootFolderIterator = systemFolder
    ? systemFolder.getFoldersByName("ShipTrack_Images")
    : DriveApp.getFoldersByName("ShipTrack_Images");
  if (rootFolderIterator.hasNext()) {
    rootFolder = rootFolderIterator.next();
  } else {
    rootFolder = systemFolder
      ? systemFolder.createFolder("ShipTrack_Images")
      : DriveApp.createFolder("ShipTrack_Images");
    try {
      rootFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) { }
  }

  // สร้างโฟลเดอร์ย่อยตามเดือน (เช่น 2026-04)
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
  let folders = rootFolder.getFoldersByName(dateStr);
  let folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = rootFolder.createFolder(dateStr);
    try {
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) { }
  }

  const splitData = finalPhotoUrl.split(',');
  const base64Data = splitData[1];
  const mimeTypeMatch = splitData[0].match(/:(.*?);/);
  const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
  const extension = mimeType === 'image/jpeg' ? 'jpg' : (mimeType.split('/')[1] || 'jpg');

  const filename = trackingId + "_" + new Date().getTime() + "." + extension;
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);

  const file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) { }

  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}

function authorizeDrive() {
  var dummy = DriveApp.createFolder("ShipTrack_Auth_Check");
  dummy.setTrashed(true);
  getSpreadsheet();
}

function migrateExistingDatesToThai() {
  getParcelSheetsForRead().forEach(function (entry) {
    const sheet = entry.sheet;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    const nextValues = values.map(function (row) {
      return [formatSheetDateValue(row[0])];
    });
    sheet.getRange(2, 2, nextValues.length, 1).setValues(nextValues);
  });

  getYearSpreadsheetsForRead().forEach(function (entry) {
    const eventSheet = entry.spreadsheet.getSheetByName("ParcelEvents");
    if (!eventSheet || eventSheet.getLastRow() <= 1) return;

    const values = eventSheet.getRange(2, 3, eventSheet.getLastRow() - 1, 1).getValues();
    const nextValues = values.map(function (row) {
      return [formatSheetDateValue(row[0])];
    });
    eventSheet.getRange(2, 3, nextValues.length, 1).setValues(nextValues);
  });

  const usersSheet = getUsersSheet();
  if (usersSheet && usersSheet.getLastRow() > 1) {
    const rowCount = usersSheet.getLastRow() - 1;
    const createdValues = usersSheet.getRange(2, 5, rowCount, 1).getValues().map(function (row) {
      return [formatSheetDateValue(row[0])];
    });
    const updatedValues = usersSheet.getRange(2, 7, rowCount, 1).getValues().map(function (row) {
      return [formatSheetDateValue(row[0])];
    });
    usersSheet.getRange(2, 5, rowCount, 1).setValues(createdValues);
    usersSheet.getRange(2, 7, rowCount, 1).setValues(updatedValues);
  }
}

function setup() {
  const ss = getSpreadsheet();
  getParcelSheet(new Date(), true);

  let eventSheet = ss.getSheetByName("ParcelEvents");
  if (!eventSheet) {
    eventSheet = ss.insertSheet("ParcelEvents");
  }
  ensureEventSheetSchema(eventSheet);

  let usersSheet = ss.getSheetByName("Users");
  if (!usersSheet) {
    usersSheet = ss.insertSheet("Users");
    usersSheet.appendRow(USER_HEADERS);
    usersSheet.getRange(1, 1, 1, USER_HEADERS.length).setFontWeight("bold");
    usersSheet.getRange(1, 1, 1, USER_HEADERS.length).setBackground("#fef3c7");
    // Add default admin
    usersSheet.appendRow(["ADMIN", "Admin", "ADMIN", encodePassword(getInitialAdminPin()), formatThaiDateForSheet(new Date()), "ACTIVE", formatThaiDateForSheet(new Date())]);
  } else {
    ensureUsersSheetSchema(usersSheet);
    const data = usersSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || "").trim() === "admin") {
        usersSheet.getRange(i + 1, 1).setValue("ADMIN");
      }
    }
  }

  getBranchesSheet();
}

function resetDefaultAdminPassword() {
  const sheet = getUsersSheet();
  const now = formatThaiDateForSheet(new Date());
  const adminPinHash = encodePassword(getInitialAdminPin());
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (normalizeEmployeeId(data[i][0]) === "ADMIN") {
      sheet.getRange(i + 1, 1, 1, USER_HEADERS.length).setValues([[
        "ADMIN",
        String(data[i][1] || "").trim() || "Admin",
        "ADMIN",
        adminPinHash,
        formatSheetDateValue(data[i][4]) || now,
        "ACTIVE",
        now
      ]]);
      return { success: true, employeeId: "ADMIN", updated: true };
    }
  }

  sheet.appendRow(["ADMIN", "Admin", "ADMIN", adminPinHash, now, "ACTIVE", now]);
  return { success: true, employeeId: "ADMIN", created: true };
}

function ensureUsersSheetSchema(sheet) {
  const branchColumn = findHeaderColumn(sheet, "Branch");
  if (branchColumn > 0) {
    sheet.deleteColumn(branchColumn);
  }
  ensureHeaderRow(sheet, USER_HEADERS, "#fef3c7");
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const statusRange = sheet.getRange(2, 6, lastRow - 1, 1);
    const statusValues = statusRange.getValues().map(function (row) {
      return [String(row[0] || "").trim() || "ACTIVE"];
    });
    statusRange.setValues(statusValues);
  }
}

function getUsersSheet() {
  const ss = getSpreadsheet();
  let usersSheet = ss.getSheetByName("Users");
  if (!usersSheet) {
    setup();
    usersSheet = ss.getSheetByName("Users");
  }
  ensureUsersSheetSchema(usersSheet);
  return usersSheet;
}

function getBranchesSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName("Branches");
  if (!sheet) {
    sheet = ss.insertSheet("Branches");
    sheet.appendRow(BRANCH_HEADERS);
    DEFAULT_BRANCHES.forEach(function (name) {
      sheet.appendRow([name, formatThaiDateForSheet(new Date()), "setup"]);
    });
  }
  ensureHeaderRow(sheet, BRANCH_HEADERS, "#e0f2fe");
  return sheet;
}

function readBranches() {
  const sheet = getBranchesSheet();
  const data = sheet.getDataRange().getValues();
  const seen = {};
  const branches = [];
  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][0] || "").trim();
    const key = name.toLowerCase();
    if (name && !seen[key]) {
      seen[key] = true;
      branches.push(name);
    }
  }
  if (branches.length === 0) {
    DEFAULT_BRANCHES.forEach(function (name) { branches.push(name); });
  }
  return branches;
}

function normalizeRole(role) {
  const value = String(role || "").trim().toUpperCase();
  if (value === "ADMIN") return "ADMIN";
  if (value === "MESSENGER" || value === "MANAGER") return "MESSENGER";
  return "GUEST";
}

function getUserRecord(employeeId) {
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  const targetId = normalizeEmployeeId(employeeId);
  for (let i = 1; i < data.length; i++) {
    if (normalizeEmployeeId(data[i][0]) === targetId) {
      return {
        rowIndex: i + 1,
        employeeId: targetId,
        name: String(data[i][1] || "").trim(),
        role: normalizeRole(data[i][2] || "GUEST"),
        pin: String(data[i][3] || "").trim(),
        createdAt: data[i][4],
        status: String(data[i][5] || "ACTIVE").trim().toUpperCase() || "ACTIVE",
        updatedAt: data[i][6]
      };
    }
  }
  return null;
}

function hasAnyRole(payload, roles) {
  return roles.indexOf(normalizeRole(payload.role)) !== -1;
}
