// Generated Google Apps Script bundle. Do not edit directly.

// --- 00_config_schema.gs ---
const SHEET_NAME = "Parcels";
const API_KEY_PROPERTY = "API_KEY";
const ADMIN_INITIAL_PIN_PROPERTY = "ADMIN_INITIAL_PIN";
const DEFAULT_ADMIN_PIN = "";
const SHIPTRACK_FOLDER_ID_PROPERTY = "SHIPTRACK_FOLDER_ID";
const VALID_ROLES = ["MESSENGER", "ADMIN"];
const TOKEN_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours
// Do not hardcode the API key here. Set Script Properties: API_KEY.
const SCRIPT_API_KEY = "";
const MAX_NOTE_LENGTH = 2000;
const MAX_BASE64_LENGTH = 6 * 1024 * 1024;
const MAX_REQUEST_LENGTH = 7 * 1024 * 1024;
const TRACKING_ID_REGEX = /^TRK\d{8}\d{4,}$/;
const EMPLOYEE_ID_REGEX = /^[A-Z0-9_]{1,50}$/;
const SAFE_PASSWORD_REGEX = /^[A-Za-z0-9!@#$%^&*()_\-+=.?]{4,100}$/;
const VALID_EVENT_TYPES = ["FORWARD", "PROXY", "DELIVERED"];
const VALID_DELIVERY_MATCH_STATUSES = ["MATCHED_DECLARED_DESTINATION", "DELIVERED_ELSEWHERE"];

// ── API Action Lists ──────────────────────────────────────────────────────────
// Protected actions require authentication token
const PROTECTED_ACTIONS = [
  'confirmReceipt', 'batchConfirmReceipt', 'startDelivery', 'batchStartDelivery',
  'releaseDelivery', 'getParcels', 'exportSummary', 'getUsers', 'createUser',
  'updateUserRole', 'updateUser', 'disableUser', 'deleteUser', 'createBranch',
  'deleteBranch', 'renameBranch', 'deleteParcel', 'editParcel', 'updateProfile',
  'getAuditLogs', 'getParcelActivityLogs', 'getSystemHealth'
];

// Write actions modify data and require idempotency handling
const WRITE_ACTIONS = [
  'createParcel', 'confirmReceipt', 'batchConfirmReceipt', 'startDelivery',
  'batchStartDelivery', 'releaseDelivery', 'login', 'setupPin', 'createUser',
  'updateUserRole', 'updateUser', 'disableUser', 'deleteUser', 'createBranch',
  'deleteBranch', 'renameBranch', 'deleteParcel', 'editParcel', 'updateProfile'
];

// Lock actions require distributed lock to prevent race conditions
const LOCK_ACTIONS = [
  'createParcel', 'confirmReceipt', 'batchConfirmReceipt', 'startDelivery',
  'batchStartDelivery', 'releaseDelivery', 'createUser', 'updateUserRole',
  'updateUser', 'disableUser', 'deleteUser', 'createBranch', 'deleteBranch',
  'renameBranch', 'deleteParcel', 'editParcel', 'updateProfile', 'setupPin'
];

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1EiIWLpHupOzkrh_Oft74U21XTeAc2KSah8H1t0ufNoQ/edit?gid=454662424#gid=454662424";
const SHIPTRACK_FOLDER_ID = "19OGCWa52JD6nFSBYcesfx51i7KjuAOT-";
const YEAR_SPREADSHEETS_PROPERTY = "YEAR_SPREADSHEETS";
const YEAR_SPREADSHEET_PREFIX = "ShipTrack";
const LEGACY_PARCEL_SHEET_NAME = SHEET_NAME;
const PARCEL_SHEET_PREFIX = "Parcels_";
const PARCEL_HEADERS = [
  "TrackingID",
  "วันที่สร้าง",
  "ผู้ส่ง",
  "สาขาผู้ส่ง",
  "ผู้รับ",
  "สาขาผู้รับ",
  "รายละเอียด",
  "หมายเหตุ",
  "สถานะ",
  "รูปยืนยัน",
  "Latitude",
  "Longitude",
  "CreatedBy",
  "OriginLatitude",
  "OriginLongitude"
];
const EVENT_HEADERS = [
  "EventID",
  "TrackingID",
  "Timestamp",
  "EventType",
  "Location",
  "DestLocation",
  "Person",
  "PhotoUrl",
  "Latitude",
  "Longitude",
  "Note",
  "DeliveryMatchStatus",
  "DeliveryMismatchReason"
];
const USER_HEADERS = ["EmployeeID", "Name", "Role", "PIN", "CreatedAt", "Status", "UpdatedAt"];
const BRANCH_HEADERS = ["Name", "CreatedAt", "CreatedBy"];
const DEFAULT_BRANCHES = [
  "MS", "พระประแดง", "บางนา", "มีนบุรี", "เลียบด่วน",
  "เดอะมอลล์บางกะปิ", "วิภาวดี", "พิบูลสงคราม", "เซ็นทรัล พระราม 2",
  "เดอะมอลล์บางแค", "มหาชัย", "ศาลายา", "กาญจนา"
];
const AUTO_PICKUP_RADIUS_METERS = 150;

// --- 10_storage_utils.gs ---
function getSpreadsheet() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    return SpreadsheetApp.openByUrl(SHEET_URL);
  }
}

function getShipTrackFolder() {
  const folderId = PropertiesService.getScriptProperties().getProperty(SHIPTRACK_FOLDER_ID_PROPERTY) || SHIPTRACK_FOLDER_ID;
  if (!folderId) return null;
  try {
    return DriveApp.getFolderById(folderId);
  } catch (e) {
    return null;
  }
}

function getYearSpreadsheetName(year) {
  return YEAR_SPREADSHEET_PREFIX + " " + year;
}

var yearSpreadsheetMapCache = null;
function getStoredYearSpreadsheetMap() {
  if (yearSpreadsheetMapCache !== null) {
    return yearSpreadsheetMapCache;
  }
  try {
    var val = PropertiesService.getScriptProperties().getProperty(YEAR_SPREADSHEETS_PROPERTY);
    yearSpreadsheetMapCache = JSON.parse(val || "{}");
    return yearSpreadsheetMapCache;
  } catch (e) {
    return {};
  }
}

function setStoredYearSpreadsheetMap(map) {
  yearSpreadsheetMapCache = map || {};
  PropertiesService.getScriptProperties().setProperty(YEAR_SPREADSHEETS_PROPERTY, JSON.stringify(map || {}));
}

function getMonthSheetName(dateOrYear, month) {
  let monthNumber = month;
  if (dateOrYear instanceof Date) {
    monthNumber = Number(Utilities.formatDate(dateOrYear, Session.getScriptTimeZone(), "MM"));
  }
  return PARCEL_SHEET_PREFIX + String(monthNumber).padStart(2, "0");
}

function getYearFromDate(date) {
  return Number(Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy"));
}

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม"
];

function formatThaiDateForSheet(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!date || isNaN(date.getTime())) return value ? String(value) : "";

  const tz = Session.getScriptTimeZone();
  const day = Number(Utilities.formatDate(date, tz, "d"));
  const month = Number(Utilities.formatDate(date, tz, "M"));
  const year = Number(Utilities.formatDate(date, tz, "yyyy")) + 543;
  const time = Utilities.formatDate(date, tz, "HH:mm");

  return day + " " + THAI_MONTHS[month - 1] + " " + year + " " + time + " น.";
}

function formatSheetDateValue(value) {
  if (!value) return "";
  if (value instanceof Date || value.getTime) {
    return formatThaiDateForSheet(value);
  }

  const text = String(value);
  const parsed = new Date(text.replace(" ", "T"));
  if (!isNaN(parsed.getTime())) {
    return formatThaiDateForSheet(parsed);
  }

  return text;
}

function parseTrackingDate(trackingID) {
  const match = String(trackingID || "").match(/^TRK(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function ensureHeaderRow(sheet, headers, background) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  const currentLastColumn = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet.getRange(1, 1, 1, currentLastColumn).getValues()[0].map(String);
  headers.forEach(function (header) {
    if (currentHeaders.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
    }
  });
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  if (background) sheet.getRange(1, 1, 1, headers.length).setBackground(background);
}

function findHeaderColumn(sheet, headerName) {
  if (!sheet || sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) return -1;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (value) {
    return String(value || "").trim();
  });
  const index = headers.indexOf(headerName);
  return index >= 0 ? index + 1 : -1;
}

function ensureParcelSheetSchema(sheet) {
  ensureHeaderRow(sheet, PARCEL_HEADERS, "#f3f4f6");
}

function ensureEventSheetSchema(sheet) {
  ensureHeaderRow(sheet, EVENT_HEADERS, "#e0f2fe");
}

function getYearSpreadsheet(year, createIfMissing) {
  const normalizedYear = Number(year || getYearFromDate(new Date()));
  const master = getSpreadsheet();
  const masterId = master.getId();
  const map = getStoredYearSpreadsheetMap();
  const mappedId = map[String(normalizedYear)];

  if (mappedId) {
    try {
      return SpreadsheetApp.openById(mappedId);
    } catch (e) {
      delete map[String(normalizedYear)];
      setStoredYearSpreadsheetMap(map);
    }
  }

  let ss;
  if (String(normalizedYear) === String(getYearFromDate(new Date())) && master.getName() === getYearSpreadsheetName(normalizedYear)) {
    ss = master;
  } else {
    const yearName = getYearSpreadsheetName(normalizedYear);
    try {
      const existingFiles = DriveApp.getFilesByName(yearName);
      while (existingFiles.hasNext()) {
        const file = existingFiles.next();
        if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
          ss = SpreadsheetApp.openById(file.getId());
          break;
        }
      }
    } catch (e) {
      ss = null;
    }

    if (ss) {
      map[String(normalizedYear)] = ss.getId();
      setStoredYearSpreadsheetMap(map);
      return ss;
    }

    if (!createIfMissing) return null;

    if (!ss) {
      ss = SpreadsheetApp.create(yearName);
    }

    try {
      const configuredFolder = getShipTrackFolder();
      const parentFolders = DriveApp.getFileById(masterId).getParents();
      const folder = configuredFolder || (parentFolders.hasNext() ? parentFolders.next() : null);
      if (folder) {
        const newFile = DriveApp.getFileById(ss.getId());
        folder.addFile(newFile);
        DriveApp.getRootFolder().removeFile(newFile);
      }
    } catch (e) {
      // Creating in root is still valid if folder move is not available.
    }
  }

  map[String(normalizedYear)] = ss.getId();
  setStoredYearSpreadsheetMap(map);
  return ss;
}

function getYearSpreadsheetsForRead() {
  const map = getStoredYearSpreadsheetMap();
  const years = Object.keys(map).map(Number).filter(function (year) { return !isNaN(year); });
  const currentYear = getYearFromDate(new Date());
  if (years.indexOf(currentYear) === -1) years.push(currentYear);
  years.sort(function (a, b) { return b - a; });

  const result = [];
  const seenIds = {};
  years.forEach(function (year) {
    const ss = getYearSpreadsheet(year, year === currentYear);
    if (ss) {
      seenIds[ss.getId()] = true;
      result.push({ year: year, spreadsheet: ss });
    }
  });

  const master = getSpreadsheet();
  const hasLegacyParcelSheets = master.getSheets().some(function (sheet) {
    return sheet.getName() === LEGACY_PARCEL_SHEET_NAME || sheet.getName().indexOf(PARCEL_SHEET_PREFIX) === 0;
  });
  if (hasLegacyParcelSheets && !seenIds[master.getId()]) {
    result.push({ year: currentYear, spreadsheet: master });
  }

  return result;
}

function getParcelSheet(date, createIfMissing) {
  const targetDate = date || new Date();
  const year = getYearFromDate(targetDate);
  const ss = getYearSpreadsheet(year, createIfMissing !== false);
  if (!ss) return null;
  const sheetName = getMonthSheetName(targetDate);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet && createIfMissing !== false) {
    sheet = ss.insertSheet(sheetName);
    try {
      CacheService.getScriptCache().remove("sheets_list_" + ss.getId());
    } catch (e) { }
  }
  if (sheet) ensureParcelSheetSchema(sheet);
  return sheet;
}

function getSpreadsheetSheetNames(spreadsheet) {
  const cache = CacheService.getScriptCache();
  const key = "sheets_list_" + spreadsheet.getId();
  const cached = cache.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) { }
  }
  const names = spreadsheet.getSheets().map(function (sheet) { return sheet.getName(); });
  try {
    cache.put(key, JSON.stringify(names), 3600); // Cache for 1 hour
  } catch (e) { }
  return names;
}

function getParcelSheetsForRead() {
  const result = [];
  getYearSpreadsheetsForRead().forEach(function (entry) {
    const sheetNames = getSpreadsheetSheetNames(entry.spreadsheet);
    const parcelSheetNames = sheetNames.filter(function (name) {
      return name === LEGACY_PARCEL_SHEET_NAME || name.indexOf(PARCEL_SHEET_PREFIX) === 0;
    });
    parcelSheetNames.sort(function (a, b) {
      if (a === LEGACY_PARCEL_SHEET_NAME) return 1;
      if (b === LEGACY_PARCEL_SHEET_NAME) return -1;
      return b.localeCompare(a);
    });
    parcelSheetNames.forEach(function (name) {
      const sheet = entry.spreadsheet.getSheetByName(name);
      if (sheet) {
        ensureParcelSheetSchema(sheet);
        result.push({ year: entry.year, spreadsheet: entry.spreadsheet, sheet: sheet });
      }
    });
  });
  return result;
}

function getParcelStorageByTrackingId(trackingID) {
  const parsed = parseTrackingDate(trackingID);
  if (parsed) {
    const ss = getYearSpreadsheet(parsed.year, false);
    if (ss) {
      const sheet = ss.getSheetByName(getMonthSheetName(parsed.year, parsed.month));
      if (sheet) {
        ensureParcelSheetSchema(sheet);
        return { spreadsheet: ss, sheet: sheet };
      }
    }
  }

  const sheets = getParcelSheetsForRead();
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i].sheet;
    const data = sheet.getDataRange().getValues();
    for (let row = 1; row < data.length; row++) {
      if (String(data[row][0]).trim() === String(trackingID).trim()) {
        return { spreadsheet: sheets[i].spreadsheet, sheet: sheet };
      }
    }
  }
  return null;
}

function getEventSheetForSpreadsheet(ss) {
  let eventSheet = ss.getSheetByName("ParcelEvents");
  if (!eventSheet) {
    eventSheet = ss.insertSheet("ParcelEvents");
  }
  ensureEventSheetSchema(eventSheet);
  return eventSheet;
}

var apiKeyCache = null;

// --- 20_auth_users.gs ---
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

// --- 30_entrypoints_routing.gs ---
function doPost(e) {
  try {
    const requestId = Utilities.getUuid();
    const startMs = Date.now();
    const rawBody = e && e.postData && e.postData.contents ? String(e.postData.contents) : "";
    
    // Validate request size early
    if (!rawBody) {
      return createJsonResponse({ success: false, error: "Request body is empty" });
    }
    if (rawBody.length > MAX_REQUEST_LENGTH) {
      return createJsonResponse({ success: false, error: "Request exceeds maximum size limit" });
    }
    
    // Parse request body with error handling
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseErr) {
      return createJsonResponse({ success: false, error: "Invalid JSON in request body" });
    }
    
    // Validate payload is an object
    if (!payload || typeof payload !== "object") {
      return createJsonResponse({ success: false, error: "Request must be a JSON object" });
    }
    const action = payload.action;
    const clientRequestId = payload.requestId ? String(payload.requestId) : requestId;
    payload.clientRequestId = payload.requestId ? String(payload.requestId) : "";
    console.info(JSON.stringify({
      level: 'info',
      event: 'api.request',
      requestId: clientRequestId,
      action: action,
      employeeId: payload.employeeId || null,
      trackingID: payload.trackingID || null,
    }));
    const configuredKey = getApiKey();
    if (!configuredKey) {
      return createJsonResponse({ success: false, error: "API key is not configured on script properties" });
    }
    
    // Secure API key comparison using constant-time comparison
    if (!secureCompareStrings(payload.apiKey, configuredKey)) {
      return createJsonResponse({ success: false, error: "Unauthorized" });
    }

    // --- Token Signature Verification ---
    if (payload.token) {
      const parts = String(payload.token).split('|');
      if (parts.length === 5) {
        const issuedAt = Number(parts[2]);
        if (isNaN(issuedAt)) {
          return createJsonResponse({ success: false, error: "Malformed token" });
        }
        const sessionLastActivityAt = getActiveSessionLastActivityAt(parts[0]) || issuedAt;
        if (Date.now() - sessionLastActivityAt > TOKEN_MAX_AGE_MS) {
          return createJsonResponse({ success: false, error: "Session expired" });
        }
        const sessionId = String(parts[3] || "");
        const payloadStr = parts[0] + "|" + parts[1] + "|" + parts[2] + "|" + sessionId;
        const expectedBytes = Utilities.computeHmacSha256Signature(payloadStr, configuredKey);
        if (Utilities.base64Encode(expectedBytes) === parts[4]) {
          const userRecord = getUserRecord(parts[0]);
          if (!userRecord) {
            return createJsonResponse({ success: false, error: "User not found" });
          }
          if (userRecord.status === "DISABLED") {
            return createJsonResponse({ success: false, error: "บัญชีนี้ถูกปิดใช้งาน" });
          }
          if (getActiveSessionId(userRecord.employeeId) !== sessionId) {
            return createJsonResponse({ success: false, error: "Session replaced" });
          }
          touchActiveSession(userRecord.employeeId, sessionId);
          // Role/name always come from sheet — stale tokens cannot keep old privileges.
          // Use distinct property names to prevent overwriting request parameters.
          payload.employeeId = userRecord.employeeId;
          payload.role = userRecord.role;
          payload.operatorName = userRecord.name;
        } else {
          return createJsonResponse({ success: false, error: "Invalid token signature" });
        }
      } else if (parts.length === 3 || parts.length === 4) {
        // Legacy token format — force a one-time re-login after deploying single-session tokens.
        return createJsonResponse({ success: false, error: "Session replaced" });
      } else {
        return createJsonResponse({ success: false, error: "Malformed token" });
      }
    } else {
      if (PROTECTED_ACTIONS.indexOf(action) !== -1) {
        return createJsonResponse({ success: false, error: "Authentication required (Missing Token)" });
      }
      payload.role = 'GUEST';
    }

    const isWrite = WRITE_ACTIONS.indexOf(action) !== -1;
    const needsLock = LOCK_ACTIONS.indexOf(action) !== -1;

    let result;
    if (isWrite && needsLock) {
      const lock = LockService.getScriptLock();
      let locked = false;
      try {
        locked = lock.tryLock(30000);
        if (!locked) {
          return createJsonResponse({ success: false, error: "System is busy, please retry" });
        }
        const cachedResult = getCachedIdempotentResponse(action, payload);
        if (cachedResult) return cachedResult;
        result = routeAction(action, payload);
        storeIdempotentResponse(action, payload, result);
      } catch (lockErr) {
        console.error("Lock error: " + (lockErr && lockErr.stack ? lockErr.stack : lockErr));
        return createJsonResponse({ success: false, error: "Failed to acquire lock, please retry" });
      } finally {
        if (locked) {
          try {
            lock.releaseLock();
          } catch (releaseErr) {
            console.error("Lock release error: " + (releaseErr && releaseErr.stack ? releaseErr.stack : releaseErr));
          }
        }
      }
    } else if (isWrite) {
      result = routeAction(action, payload);
    } else {
      result = routeAction(action, payload);
    }

    if (result) {
      // Add request context for client-side correlation (best-effort).
      try {
        const raw = JSON.parse(result.getContent());
        raw.requestId = payload.requestId || requestId;
        raw.serverTime = new Date().toISOString();
        raw.elapsedMs = Date.now() - startMs;
        return createJsonResponse(raw);
      } catch {
        return result;
      }
    }

    return createJsonResponse({ success: false, error: "Invalid action" });
  } catch (error) {
    try {
      console.error("doPost error: " + (error && error.stack ? error.stack : error));
    } catch (logError) { }
    return createJsonResponse({ success: false, error: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" });
  }
}

function routeAction(action, payload) {
  if (action === 'createParcel') return handleCreateParcel(payload);
  if (action === 'getParcels') return handleGetParcels(payload);
  if (action === 'getParcel') return handleGetParcel(payload);
  if (action === 'exportSummary') return handleExportSummary(payload);
  if (action === 'confirmReceipt') return handleConfirmReceipt(payload);
  if (action === 'batchConfirmReceipt') return handleBatchConfirmReceipt(payload);
  if (action === 'startDelivery') return handleStartDelivery(payload);
  if (action === 'batchStartDelivery') return handleBatchStartDelivery(payload);
  if (action === 'releaseDelivery') return handleReleaseDelivery(payload);
  if (action === 'searchParcels') return handleSearchParcels(payload);
  if (action === 'login') return handleLogin(payload);
  if (action === 'setupPin') return handleSetupPin(payload);
  if (action === 'getUsers') return handleGetUsers(payload);
  if (action === 'createUser') return handleCreateUser(payload);
  if (action === 'updateUserRole') return handleUpdateUserRole(payload);
  if (action === 'updateUser') return handleUpdateUser(payload);
  if (action === 'disableUser') return handleDisableUser(payload);
  if (action === 'deleteUser') return handleDeleteUser(payload);
  if (action === 'getBranches') return handleGetBranches(payload);
  if (action === 'createBranch') return handleCreateBranch(payload);
  if (action === 'deleteBranch') return handleDeleteBranch(payload);
  if (action === 'renameBranch') return handleRenameBranch(payload);
  if (action === 'getAuditLogs') return handleGetAuditLogs(payload);
  if (action === 'getParcelActivityLogs') return handleGetParcelActivityLogs(payload);
  if (action === 'getSystemHealth') return handleGetSystemHealth(payload);
  if (action === 'deleteParcel') return handleDeleteParcel(payload);
  if (action === 'editParcel') return handleEditParcel(payload);
  if (action === 'updateProfile') return handleUpdateProfile(payload);
  return null;
}

function doGet() {
  // Return minimal response — don't expose service details publicly
  return createJsonResponse({ success: true });
}

// --- 40_parcels_delivery.gs ---
function handleCreateParcel(payload) {
  if (!hasAnyRole(payload, ['ADMIN', 'MESSENGER', 'GUEST'])) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }

  // Validate required fields
  if (!payload.senderName || !payload.senderBranch || !payload.receiverName || !payload.receiverBranch || !payload.description) {
    return createJsonResponse({ success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  }

  // Rate limit: ป้องกัน spam สร้างพัสดุ
  const clientId = sanitizeText(payload.clientId || "");
  const actorId = payload.employeeId || (clientId ? "guest:" + clientId : "guest");
  const rl = checkWriteRateLimit(actorId, 'createParcel');
  if (!rl.allowed) {
    return createJsonResponse({ success: false, error: "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" });
  }

  // Sanitize inputs
  const senderName = escapeSheetValue(payload.senderName);
  const receiverName = escapeSheetValue(payload.receiverName);
  const senderBranch = escapeSheetValue(payload.senderBranch);
  const receiverBranch = escapeSheetValue(payload.receiverBranch);
  const description = escapeSheetValue(payload.description || '');
  const note = escapeSheetValue(payload.note || '');
  const originLatitude = sanitizeCoordinate(payload.latitude, -90, 90);
  const originLongitude = sanitizeCoordinate(payload.longitude, -180, 180);

  if (!senderName || !receiverName || !senderBranch || !receiverBranch || !description) {
    return createJsonResponse({ success: false, error: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" });
  }

  // Input length validation
  if (senderName.length > 200) return createJsonResponse({ success: false, error: "ชื่อผู้ส่งยาวเกินไป" });
  if (receiverName.length > 200) return createJsonResponse({ success: false, error: "ชื่อผู้รับยาวเกินไป" });
  if (senderBranch.length > 100) return createJsonResponse({ success: false, error: "ชื่อสาขาผู้ส่งยาวเกินไป" });
  if (receiverBranch.length > 100) return createJsonResponse({ success: false, error: "ชื่อสาขาผู้รับยาวเกินไป" });
  if (description.length > 200) return createJsonResponse({ success: false, error: "รายละเอียดสิ่งที่ส่งยาวเกินไป" });
  if (note.length > MAX_NOTE_LENGTH) return createJsonResponse({ success: false, error: "หมายเหตุยาวเกินไป" });
  
  const imageValidation = validateImagePayload(payload.photoUrl);
  if (!imageValidation.ok) {
    return createJsonResponse({ success: false, error: imageValidation.error });
  }

  try {
    // NOTE: Tracking ID is generated INSIDE the lock (called from writeActions block)
    // to prevent race conditions with concurrent requests.
    const date = new Date();
    const sheet = getParcelSheet(date, true);
    const yearSpreadsheet = getYearSpreadsheet(getYearFromDate(date), true);

    // Generate ID inside lock — uses full millisecond timestamp to avoid duplicates
    const dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyyMMdd");
    const trackingId = "TRK" + dateStr + String(date.getTime()).slice(-4) + Math.floor(Math.random() * 100).toString().padStart(2, '0');

    const createdDate = formatThaiDateForSheet(date);
    const createdEventDate = formatThaiDateForSheet(date);
    let finalPhotoUrl = imageValidation.value;
    
    try {
      finalPhotoUrl = saveImagePayloadToDrive(finalPhotoUrl, trackingId);
    } catch (imgErr) {
      console.error("Image save error: " + (imgErr && imgErr.stack ? imgErr.stack : imgErr));
      return createJsonResponse({ success: false, error: "ไม่สามารถบันทึกรูปภาพได้ กรุณาลองใหม่" });
    }

    sheet.appendRow([
      trackingId,
      createdDate,
      senderName,
      normalizeBranchName(senderBranch),
      receiverName,
      normalizeBranchName(receiverBranch),
      description,
      note,
      "รอจัดส่ง",
      finalPhotoUrl || "",
      "",
      "",
      payload.employeeId || (clientId ? "guest:" + clientId : "guest"),
      originLatitude,
      originLongitude
    ]);

    const eventSheet = getEventSheetForSpreadsheet(yearSpreadsheet);
    if (eventSheet) {
      const eventId = "EVT" + Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyyMMddHHmmssSSS") + Math.floor(Math.random() * 1000);
      eventSheet.appendRow([
        eventId,
        trackingId,
        createdEventDate,
        "CREATED",
        normalizeBranchName(senderBranch),
        normalizeBranchName(receiverBranch),
        senderName,
        finalPhotoUrl || "",
        originLatitude,
        originLongitude,
        note || escapeSheetValue("รับเข้าระบบ"),
        "",
        ""
      ]);
    }

    writeAuditLog(payload.employeeId, "CREATE_PARCEL", trackingId, senderName + " → " + receiverName);
    return createJsonResponse({ success: true, trackingId: trackingId });
  } catch (err) {
    console.error("handleCreateParcel error: " + (err && err.stack ? err.stack : err));
    return createJsonResponse({ success: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
  }
}
  return createJsonResponse({ success: true, trackingId: trackingId });
}

function getParcelEventsMap() {
  const eventsByTrackingId = {};

  getYearSpreadsheetsForRead().forEach(function (entry) {
    const eventSheet = entry.spreadsheet.getSheetByName("ParcelEvents");
    if (!eventSheet) return;
    const data = eventSheet.getDataRange().getValues();
    if (data.length <= 1) return;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const trackingId = row[1];

      const evt = parseEventRow(row);

      if (!eventsByTrackingId[trackingId]) {
        eventsByTrackingId[trackingId] = [];
      }
      eventsByTrackingId[trackingId].push(evt);
    }
  });

  return eventsByTrackingId;
}

function getEventsForTrackingIds(trackingIds) {
  if (!trackingIds || trackingIds.length === 0) return {};
  const eventsByTrackingId = {};
  
  const trackingIdsByYear = {};
  trackingIds.forEach(function (id) {
    const parsed = parseTrackingDate(id);
    const year = parsed ? parsed.year : getYearFromDate(new Date());
    const yearStr = String(year);
    if (!trackingIdsByYear[yearStr]) {
      trackingIdsByYear[yearStr] = [];
    }
    trackingIdsByYear[yearStr].push(String(id).trim());
  });
  
  const master = getSpreadsheet();
  const masterId = master.getId();
  const hasLegacyParcelSheets = master.getSheets().some(function (sheet) {
    const name = sheet.getName();
    return name === LEGACY_PARCEL_SHEET_NAME || name.indexOf(PARCEL_SHEET_PREFIX) === 0;
  });
  
  Object.keys(trackingIdsByYear).forEach(function (yearStr) {
    const ids = trackingIdsByYear[yearStr];
    const ss = getYearSpreadsheet(Number(yearStr), false);
    if (ss) {
      const eventSheet = ss.getSheetByName("ParcelEvents");
      if (eventSheet) {
        const data = eventSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const trackingId = String(row[1]).trim();
          if (ids.indexOf(trackingId) !== -1) {
            const evt = parseEventRow(row);
            if (!eventsByTrackingId[trackingId]) {
              eventsByTrackingId[trackingId] = [];
            }
            eventsByTrackingId[trackingId].push(evt);
          }
        }
      }
    }
    
    if (hasLegacyParcelSheets && (!ss || ss.getId() !== masterId)) {
      const legacyEventSheet = master.getSheetByName("ParcelEvents");
      if (legacyEventSheet) {
        const data = legacyEventSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const trackingId = String(row[1]).trim();
          if (ids.indexOf(trackingId) !== -1) {
            const evt = parseEventRow(row);
            if (!eventsByTrackingId[trackingId]) {
              eventsByTrackingId[trackingId] = [];
            }
            eventsByTrackingId[trackingId].push(evt);
          }
        }
      }
    }
  });
  
  return eventsByTrackingId;
}

function parseAssignedToId(note) {
  const prefix = "assignedToId=";
  const value = String(note || "").trim();
  if (value.indexOf(prefix) !== 0) return "";
  return value.substring(prefix.length).trim();
}

function buildAssignmentNote(employeeId) {
  return "assignedToId=" + normalizeEmployeeId(employeeId);
}

function parseEventRow(row) {
  return {
    id: String(row[0]),
    trackingId: String(row[1]),
    timestamp: formatSheetDateValue(row[2]),
    eventType: String(row[3]),
    location: String(row[4]),
    destLocation: String(row[5]),
    person: String(row[6]),
    photoUrl: String(row[7]),
    latitude: row[8] !== "" ? Number(row[8]) : undefined,
    longitude: row[9] !== "" ? Number(row[9]) : undefined,
    note: String(row[10]),
    deliveryMatchStatus: row[11] ? String(row[11]) : "",
    deliveryMismatchReason: row[12] ? String(row[12]) : ""
  };
}

function getParcelEventsForSpreadsheet(ss, trackingID) {
  const eventSheet = ss.getSheetByName("ParcelEvents");
  if (!eventSheet) return [];
  const data = eventSheet.getDataRange().getValues();
  const events = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(trackingID).trim()) {
      events.push(parseEventRow(data[i]));
    }
  }
  return events;
}

function getActiveDeliveryAssignmentFromEvents(events) {
  let active = null;
  for (let i = 0; i < events.length; i++) {
    const evt = events[i];
    if (evt.eventType === "START_DELIVERY") {
      const assignedToId = parseAssignedToId(evt.note);
      if (!assignedToId) continue;
      active = {
        assignedToId: assignedToId,
        assignedToName: evt.person || assignedToId || "พนักงานส่ง",
        timestamp: evt.timestamp
      };
    } else if (
      evt.eventType === "RELEASE_DELIVERY" ||
      evt.eventType === "DELIVERED" ||
      evt.eventType === "PROXY" ||
      evt.eventType === "FORWARD"
    ) {
      active = null;
    }
  }
  return active;
}

// --- 50_logs.gs ---
function normalizeLogLimit(value) {
  return Math.min(Math.max(parseInt(value) || 50, 1), 100);
}

function includesLogQuery(values, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i] || "").toLowerCase().indexOf(q) !== -1) return true;
  }
  return false;
}

function paginateLogs(rows, limit, offset) {
  const totalCount = rows.length;
  return {
    rows: rows.slice(offset, offset + limit),
    totalCount: totalCount,
    hasMore: offset + limit < totalCount
  };
}

function handleGetAuditLogs(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบ)" });
  }

  const limit = normalizeLogLimit(payload.limit);
  const offset = Math.max(parseInt(payload.offset) || 0, 0);
  const query = String(payload.query || "").trim();
  const actionFilter = String(payload.actionFilter || "").trim().toLowerCase();
  const actorFilter = String(payload.actorId || "").trim().toLowerCase();
  const targetFilter = String(payload.targetId || "").trim().toLowerCase();
  const ss = getSpreadsheet();
  const auditSheet = ss.getSheetByName("AuditLog");
  if (!auditSheet || auditSheet.getLastRow() <= 1) {
    return createJsonResponse({ success: true, logs: [], totalCount: 0, hasMore: false });
  }

  const data = auditSheet.getRange(2, 1, auditSheet.getLastRow() - 1, 5).getValues();
  const logs = [];
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    const log = {
      timestamp: formatSheetDateValue(row[0]),
      actorId: String(row[1] || ""),
      action: String(row[2] || ""),
      targetId: String(row[3] || ""),
      details: String(row[4] || "")
    };
    if (actionFilter && log.action.toLowerCase().indexOf(actionFilter) === -1) continue;
    if (actorFilter && log.actorId.toLowerCase().indexOf(actorFilter) === -1) continue;
    if (targetFilter && log.targetId.toLowerCase().indexOf(targetFilter) === -1) continue;
    if (!includesLogQuery([log.timestamp, log.actorId, log.action, log.targetId, log.details], query)) continue;
    logs.push(log);
  }

  const page = paginateLogs(logs, limit, offset);
  return createJsonResponse({ success: true, logs: page.rows, totalCount: page.totalCount, hasMore: page.hasMore });
}

function handleGetParcelActivityLogs(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบ)" });
  }

  const limit = normalizeLogLimit(payload.limit);
  const offset = Math.max(parseInt(payload.offset) || 0, 0);
  const query = String(payload.query || "").trim();
  const eventTypeFilter = String(payload.eventType || "").trim().toUpperCase();
  const trackingFilter = String(payload.trackingId || "").trim().toLowerCase();
  const activities = [];

  getYearSpreadsheetsForRead().forEach(function (entry) {
    const eventSheet = entry.spreadsheet.getSheetByName("ParcelEvents");
    if (!eventSheet || eventSheet.getLastRow() <= 1) return;
    const data = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, EVENT_HEADERS.length).getValues();
    for (let i = data.length - 1; i >= 0; i--) {
      const activity = parseEventRow(data[i]);
      const eventType = String(activity.eventType || "").toUpperCase();
      const trackingId = String(activity.trackingId || "");
      if (eventTypeFilter && eventType !== eventTypeFilter) continue;
      if (trackingFilter && trackingId.toLowerCase().indexOf(trackingFilter) === -1) continue;
      if (!includesLogQuery([
        activity.id,
        activity.trackingId,
        activity.timestamp,
        activity.eventType,
        activity.location,
        activity.destLocation,
        activity.person,
        activity.note,
        activity.deliveryMatchStatus,
        activity.deliveryMismatchReason
      ], query)) continue;
      activities.push(activity);
    }
  });

  const page = paginateLogs(activities, limit, offset);
  return createJsonResponse({ success: true, activities: page.rows, totalCount: page.totalCount, hasMore: page.hasMore });
}

// --- 51_parcel_reads.gs ---
function handleGetParcels(payload) {
  const limit = Math.min(Math.max(parseInt(payload.limit) || 50, 1), 100);
  const offset = Math.max(parseInt(payload.offset) || 0, 0);
  const parcels = [];
  let skipped = 0;
  let totalCount = 0;
  let hasMore = false;

  const sheets = getParcelSheetsForRead();
  if (!sheets.length) {
    return createJsonResponse({ success: true, parcels: [], totalCount: 0, hasMore: false });
  }

  sheets.forEach(function (entry) {
    const sheet = entry.sheet;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i];

      if (payload.status && payload.status !== "ทั้งหมด") {
        if (row[8] !== payload.status) {
          continue;
        }
      }

      totalCount++;
      if (skipped < offset) {
        skipped++;
        continue;
      }
      if (parcels.length >= limit) {
        hasMore = true;
        continue;
      }

      const parcel = {};
      for (let j = 0; j < headers.length; j++) {
        parcel[headers[j]] = row[j];
      }

      parcel["วันที่สร้าง"] = formatSheetDateValue(parcel["วันที่สร้าง"]);

      parcels.push(parcel);
    }
  });

  const trackingIds = parcels.map(function (p) { return p.TrackingID; });
  const eventsMap = getEventsForTrackingIds(trackingIds);
  for (let p of parcels) {
    p.events = eventsMap[p.TrackingID] || [];
  }

  return createJsonResponse({
    success: true,
    parcels: parcels,
    totalCount: totalCount,
    hasMore: hasMore
  });
}

function handleGetParcel(payload) {
  if (!validateTrackingID(payload.trackingID)) {
    return createJsonResponse({ success: false, error: "รูปแบบหมายเลขติดตามไม่ถูกต้อง" });
  }
  const isGuest = normalizeRole(payload.role) === "GUEST";
  const storage = getParcelStorageByTrackingId(payload.trackingID);
  if (!storage) {
    return createJsonResponse({ success: false, error: "ไม่พบข้อมูล" });
  }
  const sheet = storage.sheet;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === payload.trackingID) {
      if (!isGuest && !canReadParcelRow(payload, row)) {
        return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึงรายการนี้" });
      }

      const parcel = {};
      for (let j = 0; j < headers.length; j++) {
        parcel[headers[j]] = row[j];
      }

      parcel["วันที่สร้าง"] = formatSheetDateValue(parcel["วันที่สร้าง"]);

      if (isGuest) {
        return createJsonResponse({ success: true, parcel: redactParcelForGuest(parcel) });
      }

      const eventsMap = getParcelEventsMap();
      parcel.events = eventsMap[payload.trackingID] || [];

      return createJsonResponse({ success: true, parcel: parcel });
    }
  }

  return createJsonResponse({ success: false, error: "ไม่พบข้อมูล" });
}

function handleExportSummary(payload) {
  if (!hasAnyRole(payload, ['ADMIN', 'MESSENGER'])) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }
  let total = 0, pending = 0, transit = 0, delivered = 0;

  // Build events map once for derived status calculation
  const eventsMap = getParcelEventsMap();

  getParcelSheetsForRead().forEach(function (entry) {
    const data = entry.sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      let status = String(row[8] || "");
      const trackingID = String(row[0] || "");
      total++;

      // Apply derived status: if last event was FORWARD, treat as กำลังจัดส่ง
      if (status === "ส่งสำเร็จ") {
        const events = eventsMap[trackingID] || [];
        const actionEvents = events.filter(function (e) {
          return e.eventType === 'FORWARD' || e.eventType === 'START_DELIVERY' || e.eventType === 'PICKUP' || e.eventType === 'RELEASE_DELIVERY' || e.eventType === 'DELIVERED' || e.eventType === 'PROXY';
        });
        if (
          actionEvents.length > 0 &&
          (actionEvents[actionEvents.length - 1].eventType === 'FORWARD' || actionEvents[actionEvents.length - 1].eventType === 'START_DELIVERY' || actionEvents[actionEvents.length - 1].eventType === 'PICKUP')
        ) {
          status = "กำลังจัดส่ง";
        } else if (actionEvents.length > 0 && actionEvents[actionEvents.length - 1].eventType === 'RELEASE_DELIVERY') {
          status = "รอจัดส่ง";
        }
      }

      if (status === "รอจัดส่ง") pending++;
      else if (status === "กำลังจัดส่ง") transit++;
      else if (status === "ส่งสำเร็จ") delivered++;
    }
  });

  return createJsonResponse({
    success: true,
    summary: { total, pending, transit, delivered }
  });
}

// --- 52_delivery_handlers.gs ---
var _batchEventsMapBySpreadsheetId = null;

function handleConfirmReceipt(payload) {
  if (!hasAnyRole(payload, ['ADMIN', 'MESSENGER'])) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }

  // Rate limit: ป้องกัน spam ยืนยันพัสดุ
  if (!payload.skipRateLimit) {
    const rl = checkWriteRateLimit(payload.employeeId, 'confirmReceipt');
    if (!rl.allowed) {
      return createJsonResponse({ success: false, error: "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" });
    }
  }

  if (!validateTrackingID(payload.trackingID)) {
    return createJsonResponse({ success: false, error: "รูปแบบหมายเลขติดตามไม่ถูกต้อง" });
  }
  if (!payload.photoUrl) {
    return createJsonResponse({ success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  }

  // Location must be provided by the frontend payload during forwarding or delivery
  if (VALID_EVENT_TYPES.indexOf(String(payload.eventType || "")) === -1) {
    return createJsonResponse({ success: false, error: "ประเภทการยืนยันไม่ถูกต้อง" });
  }

  const sanitizedNote = payload.note ? escapeSheetValue(payload.note) : '';
  const eventLocation = escapeSheetValue(payload.location || "");
  const eventDestLocation = escapeSheetValue(payload.destLocation || "");
  const eventPerson = escapeSheetValue(payload.person || "");
  const isFinalDeliveryEvent = payload.eventType === "DELIVERED" || payload.eventType === "PROXY";
  const rawDeliveryMatchStatus = String(payload.deliveryMatchStatus || "");
  const deliveryMatchStatus = isFinalDeliveryEvent
    ? escapeSheetValue(rawDeliveryMatchStatus || "MATCHED_DECLARED_DESTINATION")
    : "";
  const deliveryMismatchReason = isFinalDeliveryEvent && deliveryMatchStatus === "DELIVERED_ELSEWHERE"
    ? escapeSheetValue(payload.deliveryMismatchReason || "")
    : "";
  if (sanitizedNote.length > MAX_NOTE_LENGTH) {
    return createJsonResponse({ success: false, error: "หมายเหตุยาวเกินไป" });
  }
  if (eventLocation.length > 100 || eventDestLocation.length > 100) {
    return createJsonResponse({ success: false, error: "ชื่อสาขายาวเกินไป" });
  }
  if (eventPerson.length > 200) {
    return createJsonResponse({ success: false, error: "ชื่อผู้รับ/ผู้ส่งต่อยาวเกินไป" });
  }
  if (deliveryMatchStatus && VALID_DELIVERY_MATCH_STATUSES.indexOf(deliveryMatchStatus) === -1) {
    return createJsonResponse({ success: false, error: "สถานะยืนยันปลายทางไม่ถูกต้อง" });
  }
  if (deliveryMismatchReason.length > 500) {
    return createJsonResponse({ success: false, error: "เหตุผลที่ส่งคนละจุดยาวเกินไป" });
  }
  if (deliveryMatchStatus === "DELIVERED_ELSEWHERE" && !deliveryMismatchReason) {
    return createJsonResponse({ success: false, error: "กรุณาระบุเหตุผลที่ส่งคนละจุด" });
  }
  const imageValidation = validateImagePayload(payload.photoUrl);
  if (!imageValidation.ok) {
    return createJsonResponse({ success: false, error: imageValidation.error });
  }
  const storage = getParcelStorageByTrackingId(payload.trackingID);
  if (!storage) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }
  const sheet = storage.sheet;
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === payload.trackingID) {
      const rowIndex = i + 1;
      const currentStatus = row[8];
      const noteStr = String(row[7] || "");
      // In batch confirm flow we may preload ParcelEvents to avoid reading the same sheet repeatedly.
      let events;
      const spreadsheetId = storage.spreadsheet.getId();
      if (_batchEventsMapBySpreadsheetId && _batchEventsMapBySpreadsheetId[spreadsheetId]) {
        events = _batchEventsMapBySpreadsheetId[spreadsheetId][payload.trackingID];
      }
      if (!events) {
        events = getParcelEventsForSpreadsheet(storage.spreadsheet, payload.trackingID);
      }
      const activeAssignment = getActiveDeliveryAssignmentFromEvents(events);
      if (
        activeAssignment &&
        activeAssignment.assignedToId &&
        activeAssignment.assignedToId !== normalizeEmployeeId(payload.employeeId) &&
        normalizeRole(payload.role) !== "ADMIN" &&
        payload.eventType !== "FORWARD"
      ) {
        return createJsonResponse({
          success: false,
          error: "งานนี้มีผู้รับงานแล้ว: " + activeAssignment.assignedToName,
          assignedToId: activeAssignment.assignedToId,
          assignedToName: activeAssignment.assignedToName
        });
      }

      let isActuallyDelivered = currentStatus === "ส่งสำเร็จ";

      // ── State Machine Validation ──────────────────────────────────────────
      // Valid transitions:
      //   รอจัดส่ง    → กำลังจัดส่ง  (FORWARD)
      //   กำลังจัดส่ง → กำลังจัดส่ง  (FORWARD)
      //   รอจัดส่ง    → ส่งสำเร็จ   (DELIVERED / PROXY)
      //   กำลังจัดส่ง → ส่งสำเร็จ   (DELIVERED / PROXY)
      //   ส่งสำเร็จ  → ❌ ห้ามเปลี่ยน
      if (isActuallyDelivered) {
        return createJsonResponse({ success: false, error: "รายการนี้ถูกส่งสำเร็จแล้ว ไม่สามารถเปลี่ยนสถานะได้" });
      }

      let newStatus = currentStatus;
      if (payload.eventType === 'DELIVERED' || payload.eventType === 'PROXY') {
        newStatus = "ส่งสำเร็จ";
      } else if (payload.eventType === 'FORWARD') {
        if (currentStatus === "ส่งสำเร็จ") {
          return createJsonResponse({ success: false, error: "ไม่สามารถส่งต่อรายการที่ส่งสำเร็จแล้ว" });
        }
        newStatus = "กำลังจัดส่ง";
      }

      // Only update main status if it changed
      if (newStatus !== currentStatus) {
        sheet.getRange(rowIndex, 9).setValue(newStatus);
      }

      let finalPhotoUrl = imageValidation.value;

      if (finalPhotoUrl && finalPhotoUrl.startsWith('data:image')) {
        try {
          finalPhotoUrl = saveImagePayloadToDrive(finalPhotoUrl, payload.trackingID);
        } catch (e) {
          return createJsonResponse({ success: false, error: "ไม่สามารถบันทึกรูปภาพได้ กรุณาลองใหม่" });
        }
      }

      // Update main sheet's photo if delivered, or leave it. Actually, update it if it's the latest proof.
      if (finalPhotoUrl) {
        sheet.getRange(rowIndex, 10).setValue(finalPhotoUrl);
      }

      if (sanitizedNote) {
        const existingNote = sheet.getRange(rowIndex, 8).getValue();
        sheet.getRange(rowIndex, 8).setValue(existingNote ? existingNote + "\n" + sanitizedNote : sanitizedNote);
      }

      const eventLatitude = sanitizeCoordinate(payload.latitude, -90, 90);
      const eventLongitude = sanitizeCoordinate(payload.longitude, -180, 180);

      // Save sanitized coordinates into main tracking columns (if provided)
      if (eventLatitude !== "" && eventLongitude !== "") {
        sheet.getRange(rowIndex, 11).setValue(eventLatitude);
        sheet.getRange(rowIndex, 12).setValue(eventLongitude);
      }

      // Insert structured event into ParcelEvents
      if (payload.eventType) {
        const eventSheet = getEventSheetForSpreadsheet(storage.spreadsheet);
        if (eventSheet) {
          const eventId = "EVT" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmssSSS") + Math.floor(Math.random() * 1000);
          const eventTimeStr = formatThaiDateForSheet(new Date());
          eventSheet.appendRow([
            eventId,
            payload.trackingID,
            eventTimeStr,
            payload.eventType,
            eventLocation,
            eventDestLocation,
            eventPerson,
            finalPhotoUrl || "",
            eventLatitude,
            eventLongitude,
            sanitizedNote || "",
            deliveryMatchStatus,
            deliveryMismatchReason
          ]);
        }
      }

      writeAuditLog(payload.employeeId, "CONFIRM_RECEIPT_" + (payload.eventType || "UNKNOWN"), payload.trackingID, "Status: " + currentStatus + " → " + newStatus);
      return createJsonResponse({ success: true });
    }
  }

  return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
}

function parseJsonTextOutput(output) {
  try {
    return JSON.parse(output.getContent());
  } catch (e) {
    return { success: false, error: "ระบบตอบกลับไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง" };
  }
}

function normalizeTrackingIdList(value) {
  if (!Array.isArray(value)) return [];
  const seen = {};
  const result = [];
  value.forEach(function (item) {
    const trackingID = String(item || "").trim();
    if (!trackingID || seen[trackingID]) return;
    seen[trackingID] = true;
    result.push(trackingID);
  });
  return result;
}

function getBatchDeliveryDefaults(payload, trackingID) {
  const storage = getParcelStorageByTrackingId(trackingID);
  if (!storage) return {};
  const data = storage.sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] !== trackingID) continue;
    if (!canReadParcelRow(payload, row)) return {};
    return {
      location: escapeSheetValue(row[5] || ""),
      person: escapeSheetValue(row[4] || "")
    };
  }
  return {};
}

function getBatchDeliveryDefaultsMap(payload, trackingIDs) {
  const defaultsByTrackingId = {};

  // Group tracking IDs by (spreadsheetId + sheetName) to avoid reading the same sheet repeatedly.
  const groups = {}; // key -> { storage, trackingIdSet }
  trackingIDs.forEach(function (trackingID) {
    const storage = getParcelStorageByTrackingId(trackingID);
    if (!storage) return;
    const key = storage.spreadsheet.getId() + "|" + storage.sheet.getName();
    if (!groups[key]) {
      groups[key] = { storage: storage, trackingIdSet: {} };
    }
    groups[key].trackingIdSet[String(trackingID).trim()] = true;
  });

  Object.keys(groups).forEach(function (key) {
    const group = groups[key];
    const data = group.storage.sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowTrackingId = String(row[0]).trim();
      if (!group.trackingIdSet[rowTrackingId]) continue;
      if (!canReadParcelRow(payload, row)) continue;
      defaultsByTrackingId[rowTrackingId] = {
        location: escapeSheetValue(row[5] || ""),
        person: escapeSheetValue(row[4] || "")
      };
    }
  });

  return defaultsByTrackingId;
}

function getBatchParcelEventsMapBySpreadsheetId(trackingIDs) {
  const groups = {}; // spreadsheetId -> { spreadsheet, trackingIdSet }
  trackingIDs.forEach(function (trackingID) {
    const storage = getParcelStorageByTrackingId(trackingID);
    if (!storage) return;
    const spreadsheetId = storage.spreadsheet.getId();
    if (!groups[spreadsheetId]) {
      groups[spreadsheetId] = { spreadsheet: storage.spreadsheet, trackingIdSet: {} };
    }
    groups[spreadsheetId].trackingIdSet[String(trackingID).trim()] = true;
  });

  const eventsBySpreadsheetId = {};
  Object.keys(groups).forEach(function (spreadsheetId) {
    const group = groups[spreadsheetId];
    const eventSheet = group.spreadsheet.getSheetByName("ParcelEvents");
    if (!eventSheet || eventSheet.getLastRow() <= 1) return;

    const data = eventSheet.getDataRange().getValues();
    const eventsByTrackingId = {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowTrackingId = String(row[1]).trim();
      if (!group.trackingIdSet[rowTrackingId]) continue;
      if (!eventsByTrackingId[rowTrackingId]) eventsByTrackingId[rowTrackingId] = [];
      eventsByTrackingId[rowTrackingId].push(parseEventRow(row));
    }

    eventsBySpreadsheetId[spreadsheetId] = eventsByTrackingId;
  });

  return eventsBySpreadsheetId;
}

function handleBatchConfirmReceipt(payload) {
  if (!hasAnyRole(payload, ['ADMIN', 'MESSENGER'])) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }

  const rl = checkWriteRateLimit(payload.employeeId, 'batchConfirmReceipt');
  if (!rl.allowed) return createJsonResponse({ success: false, error: "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" });

  const trackingIDs = normalizeTrackingIdList(payload.trackingIDs);
  if (trackingIDs.length === 0) return createJsonResponse({ success: false, error: "กรุณาเลือกรายการพัสดุ" });
  if (trackingIDs.length > 50) return createJsonResponse({ success: false, error: "ทำรายการพร้อมกันได้ไม่เกิน 50 รายการ" });

  const imageValidation = validateImagePayload(payload.photoUrl);
  if (!imageValidation.ok) return createJsonResponse({ success: false, error: imageValidation.error });

  let sharedPhotoUrl = imageValidation.value;
  try {
    sharedPhotoUrl = saveImagePayloadToDrive(sharedPhotoUrl, "BATCH_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss"));
  } catch (e) {
    return createJsonResponse({ success: false, error: "ไม่สามารถบันทึกรูปภาพได้ กรุณาลองใหม่" });
  }

  try {
    _batchEventsMapBySpreadsheetId = getBatchParcelEventsMapBySpreadsheetId(trackingIDs);

    const defaultsMap = getBatchDeliveryDefaultsMap(payload, trackingIDs);
    const results = trackingIDs.map(function (trackingID) {
      const defaults = defaultsMap[String(trackingID).trim()] || {};
      const singlePayload = Object.assign({}, payload, {
        trackingID: trackingID,
        photoUrl: sharedPhotoUrl,
        eventType: "DELIVERED",
        location: defaults.location || payload.location || "",
        person: defaults.person || payload.person || "",
        deliveryMatchStatus: "MATCHED_DECLARED_DESTINATION",
        deliveryMismatchReason: "",
        skipRateLimit: true,
        idempotencyKey: ""
      });
      const result = parseJsonTextOutput(handleConfirmReceipt(singlePayload));
      return {
        trackingID: trackingID,
        success: !!result.success,
        error: result.error || ""
      };
    });

    const successCount = results.filter(function (item) { return item.success; }).length;
    const failedCount = results.length - successCount;
    writeAuditLog(payload.employeeId, "BATCH_CONFIRM_RECEIPT", trackingIDs.join(","), "success=" + successCount + " failed=" + failedCount);
    return createJsonResponse({
      success: successCount > 0,
      sharedPhotoUrl: sharedPhotoUrl,
      successCount: successCount,
      failedCount: failedCount,
      results: results
    });
  } finally {
    _batchEventsMapBySpreadsheetId = null;
  }
}

function handleBatchStartDelivery(payload) {
  if (!hasAnyRole(payload, ['ADMIN', 'MESSENGER'])) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }

  const rl = checkWriteRateLimit(payload.employeeId, 'batchStartDelivery');
  if (!rl.allowed) return createJsonResponse({ success: false, error: "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" });

  const trackingIDs = normalizeTrackingIdList(payload.trackingIDs);
  if (trackingIDs.length === 0) return createJsonResponse({ success: false, error: "กรุณาเลือกรายการพัสดุ" });
  if (trackingIDs.length > 50) return createJsonResponse({ success: false, error: "ทำรายการพร้อมกันได้ไม่เกิน 50 รายการ" });

  const results = trackingIDs.map(function (trackingID) {
    const singlePayload = Object.assign({}, payload, {
      trackingID: trackingID,
      skipRateLimit: true,
      idempotencyKey: ""
    });
    const result = parseJsonTextOutput(handleStartDelivery(singlePayload));
    return {
      trackingID: trackingID,
      success: !!result.success,
      error: result.error || "",
      alreadyStarted: !!result.alreadyStarted,
      assignedToId: result.assignedToId || "",
      assignedToName: result.assignedToName || "",
      autoPickedUp: !!result.autoPickedUp
    };
  });

  const successCount = results.filter(function (item) { return item.success; }).length;
  const failedCount = results.length - successCount;
  writeAuditLog(payload.employeeId, "BATCH_START_DELIVERY", trackingIDs.join(","), "success=" + successCount + " failed=" + failedCount);
  return createJsonResponse({
    success: successCount > 0,
    successCount: successCount,
    failedCount: failedCount,
    results: results
  });
}

function handleStartDelivery(payload) {
  if (!hasAnyRole(payload, ['ADMIN', 'MESSENGER'])) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }

  if (!payload.skipRateLimit) {
    const rl = checkWriteRateLimit(payload.employeeId, 'startDelivery');
    if (!rl.allowed) {
      return createJsonResponse({ success: false, error: "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" });
    }
  }

  if (!validateTrackingID(payload.trackingID)) {
    return createJsonResponse({ success: false, error: "รูปแบบหมายเลขติดตามไม่ถูกต้อง" });
  }

  const storage = getParcelStorageByTrackingId(payload.trackingID);
  if (!storage) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }

  const sheet = storage.sheet;
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === payload.trackingID) {
      if (!canReadParcelRow(payload, row)) {
        return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
      }

      const rowIndex = i + 1;
      const currentStatus = String(row[8] || "");
      const events = getParcelEventsForSpreadsheet(storage.spreadsheet, payload.trackingID);
      const activeAssignment = getActiveDeliveryAssignmentFromEvents(events);
      const currentEmployeeId = normalizeEmployeeId(payload.employeeId);

      if (currentStatus === "ส่งสำเร็จ") {
        return createJsonResponse({ success: false, error: "รายการนี้ส่งสำเร็จแล้ว ไม่สามารถรับงานซ้ำได้" });
      }

      if (activeAssignment && activeAssignment.assignedToId && activeAssignment.assignedToId !== currentEmployeeId) {
        return createJsonResponse({
          success: false,
          error: "งานนี้มีผู้รับงานแล้ว: " + activeAssignment.assignedToName,
          assignedToId: activeAssignment.assignedToId,
          assignedToName: activeAssignment.assignedToName
        });
      }

      if (activeAssignment && activeAssignment.assignedToId === currentEmployeeId) {
        return createJsonResponse({
          success: true,
          alreadyStarted: true,
          assignedToId: activeAssignment.assignedToId,
          assignedToName: activeAssignment.assignedToName
        });
      }

      if (currentStatus !== "กำลังจัดส่ง") {
        sheet.getRange(rowIndex, 9).setValue("กำลังจัดส่ง");
      }

      const startLatitude = sanitizeCoordinate(payload.latitude, -90, 90);
      const startLongitude = sanitizeCoordinate(payload.longitude, -180, 180);
      const originLatitude = sanitizeCoordinate(row[13], -90, 90);
      const originLongitude = sanitizeCoordinate(row[14], -180, 180);
      const pickupDistance = getDistanceMeters(startLatitude, startLongitude, originLatitude, originLongitude);
      const autoPickedUp = pickupDistance !== null && pickupDistance <= AUTO_PICKUP_RADIUS_METERS;

      const eventSheet = getEventSheetForSpreadsheet(storage.spreadsheet);
      if (eventSheet) {
        const eventId = "EVT" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmssSSS") + Math.floor(Math.random() * 1000);
        const eventTimeStr = formatThaiDateForSheet(new Date());
        const assignedToName = escapeSheetValue(payload.operatorName || payload.name || payload.employeeId || "");
        eventSheet.appendRow([
          eventId,
          payload.trackingID,
          eventTimeStr,
          "START_DELIVERY",
          escapeSheetValue(row[3] || ""),
          escapeSheetValue(row[5] || ""),
          assignedToName,
          "",
          startLatitude,
          startLongitude,
          buildAssignmentNote(payload.employeeId),
          "",
          ""
        ]);
        if (autoPickedUp) {
          const pickupEventId = "EVT" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmssSSS") + Math.floor(Math.random() * 1000);
          eventSheet.appendRow([
            pickupEventId,
            payload.trackingID,
            eventTimeStr,
            "PICKUP",
            escapeSheetValue(row[3] || ""),
            escapeSheetValue(row[5] || ""),
            assignedToName,
            "",
            startLatitude,
            startLongitude,
            "autoPickup=originGpsMatched;distanceMeters=" + Math.round(pickupDistance),
            "",
            ""
          ]);
        }
      }

      writeAuditLog(payload.employeeId, "START_DELIVERY", payload.trackingID, "Status: " + currentStatus + " → กำลังจัดส่ง");
      return createJsonResponse({
        success: true,
        assignedToId: currentEmployeeId,
        assignedToName: payload.operatorName || payload.name || payload.employeeId || "",
        autoPickedUp: autoPickedUp
      });
    }
  }

  return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
}

function handleReleaseDelivery(payload) {
  if (!hasAnyRole(payload, ['ADMIN', 'MESSENGER'])) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }

  const rl = checkWriteRateLimit(payload.employeeId, 'releaseDelivery');
  if (!rl.allowed) {
    return createJsonResponse({ success: false, error: "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" });
  }

  if (!validateTrackingID(payload.trackingID)) {
    return createJsonResponse({ success: false, error: "รูปแบบหมายเลขติดตามไม่ถูกต้อง" });
  }

  const storage = getParcelStorageByTrackingId(payload.trackingID);
  if (!storage) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }

  const sheet = storage.sheet;
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === payload.trackingID) {
      if (!canReadParcelRow(payload, row)) {
        return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
      }

      const rowIndex = i + 1;
      const currentStatus = String(row[8] || "");
      const events = getParcelEventsForSpreadsheet(storage.spreadsheet, payload.trackingID);
      const activeAssignment = getActiveDeliveryAssignmentFromEvents(events);
      const currentEmployeeId = normalizeEmployeeId(payload.employeeId);
      const isAdmin = normalizeRole(payload.role) === "ADMIN";

      if (currentStatus === "ส่งสำเร็จ") {
        return createJsonResponse({ success: false, error: "รายการนี้ส่งสำเร็จแล้ว ไม่สามารถคืนงานได้" });
      }

      if (!activeAssignment) {
        if (currentStatus !== "รอจัดส่ง") {
          sheet.getRange(rowIndex, 9).setValue("รอจัดส่ง");
        }
        return createJsonResponse({ success: true, alreadyReleased: true });
      }

      if (!isAdmin && activeAssignment.assignedToId && activeAssignment.assignedToId !== currentEmployeeId) {
        return createJsonResponse({
          success: false,
          error: "คืนงานได้เฉพาะคนที่รับงานไว้หรือผู้ดูแลระบบ",
          assignedToId: activeAssignment.assignedToId,
          assignedToName: activeAssignment.assignedToName
        });
      }

      sheet.getRange(rowIndex, 9).setValue("รอจัดส่ง");

      const eventSheet = getEventSheetForSpreadsheet(storage.spreadsheet);
      if (eventSheet) {
        const eventId = "EVT" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmssSSS") + Math.floor(Math.random() * 1000);
        const eventTimeStr = formatThaiDateForSheet(new Date());
        eventSheet.appendRow([
          eventId,
          payload.trackingID,
          eventTimeStr,
          "RELEASE_DELIVERY",
          escapeSheetValue(row[3] || ""),
          escapeSheetValue(row[5] || ""),
          escapeSheetValue(payload.operatorName || payload.name || payload.employeeId || ""),
          "",
          "",
          "",
          buildAssignmentNote(payload.employeeId),
          "",
          ""
        ]);
      }

      writeAuditLog(payload.employeeId, "RELEASE_DELIVERY", payload.trackingID, "Status: " + currentStatus + " → รอจัดส่ง");
      return createJsonResponse({ success: true });
    }
  }

  return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
}

// --- 53_route_search.gs ---
function handleSearchParcels(payload) {
  const query = sanitizeText(payload.query || "");
  if (!query) {
    return createJsonResponse({ success: true, parcels: [] });
  }

  // Query length limit (frontend also enforces 100 chars)
  if (query.length > 100) {
    return createJsonResponse({ success: false, error: "คำค้นหายาวเกินไป" });
  }

  const role = normalizeRole(payload.role);
  const isGuest = role === "GUEST";
  if (!isGuest && !hasAnyRole(payload, ['ADMIN', 'MESSENGER'])) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }

  // Rate limit: max 30 searches per minute per authenticated user.
  const cache = CacheService.getScriptCache();
  const searchActor = isGuest ? "guest" : normalizeEmployeeId(payload.employeeId);
  const rateLimitKey = "search_rate_" + searchActor;
  const rateRaw = cache.get(rateLimitKey);
  const rateCount = rateRaw ? Number(rateRaw) : 0;
  if (rateCount >= 30) {
    return createJsonResponse({ success: false, error: "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่" });
  }
  cache.put(rateLimitKey, String(rateCount + 1), 60);

  if (isGuest && !validateTrackingID(query) && query.length < 2) {
    return createJsonResponse({ success: true, parcels: [] });
  }

  const queryLower = query.toLowerCase();
  const parcels = [];

  const sheets = getParcelSheetsForRead();
  for (let s = 0; s < sheets.length && parcels.length < 50; s++) {
    const sheet = sheets[s].sheet;
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) continue;
    const headers = data[0];

    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      const tracking = String(row[0] || "").toLowerCase();
      const sender = String(row[2] || "").toLowerCase();
      const receiver = String(row[4] || "").toLowerCase();
      const destination = String(row[5] || "").toLowerCase();
      const description = String(row[6] || "").toLowerCase();

      if (isGuest) {
        if (tracking !== queryLower && receiver.indexOf(queryLower) === -1) continue;
      } else {
        if (!canReadParcelRow(payload, row)) continue;
        if (tracking.indexOf(queryLower) === -1 && sender.indexOf(queryLower) === -1 && receiver.indexOf(queryLower) === -1 && destination.indexOf(queryLower) === -1 && description.indexOf(queryLower) === -1) {
          continue;
        }
      }

      const parcel = {};
      for (let j = 0; j < headers.length; j++) {
        parcel[headers[j]] = row[j];
      }

      parcel["วันที่สร้าง"] = formatSheetDateValue(parcel["วันที่สร้าง"]);
      if (isGuest) {
        parcels.push(redactParcelForGuest(parcel));
        if (parcels.length >= 50) break;
        continue;
      }

      parcels.push(parcel);
      if (parcels.length >= 50) break;
    }
  }

  if (!isGuest && parcels.length > 0) {
    // Attach events only for authenticated users. Public search should not expose proof images or GPS details.
    const trackingIds = parcels.map(function (p) { return p.TrackingID; });
    const eventsMap = getEventsForTrackingIds(trackingIds);
    for (let p of parcels) {
      p.events = eventsMap[p.TrackingID] || [];
    }
  }

  return createJsonResponse({ success: true, parcels: parcels });
}

// --- 60_auth_handlers.gs ---
function setupApiKey(value) {
  if (!value) {
    throw new Error("Missing API key value");
  }
  const trimmedKey = String(value).trim();
  if (trimmedKey.length < 32) {
    throw new Error("API key must be at least 32 characters long");
  }
  PropertiesService.getScriptProperties().setProperty(API_KEY_PROPERTY, trimmedKey);
  // Clear cache after updating
  apiKeyCache = null;
}

function setupInitialAdminPin(value) {
  const pin = sanitizePassword(value);
  if (!validatePassword(pin) || pin.length > 100) {
    throw new Error("Admin PIN must be 4-100 allowed characters and must not start with = + - or @");
  }
  PropertiesService.getScriptProperties().setProperty(ADMIN_INITIAL_PIN_PROPERTY, pin);
  return { success: true };
}

// ── Security Utilities ────────────────────────────────────────────────────────
/**
 * Constant-time string comparison to prevent timing attacks.
 * Compares two strings and returns true if they match, false otherwise.
 */
function secureCompareStrings(provided, expected) {
  if (!provided || !expected) return false;
  
  const providedStr = String(provided || "");
  const expectedStr = String(expected || "");
  
  // Ensure both strings are non-empty and of equal length
  if (providedStr.length !== expectedStr.length) return false;
  
  let match = 0;
  for (let i = 0; i < providedStr.length; i++) {
    match |= providedStr.charCodeAt(i) ^ expectedStr.charCodeAt(i);
  }
  return match === 0;
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
  const raw = PropertiesService.getScriptProperties().getProperty(key) || "";
  try {
    const parsed = JSON.parse(raw);
    return String(parsed.sessionId || "");
  } catch (e) {
    return raw;
  }
}

function getActiveSessionLastActivityAt(employeeId) {
  const key = "active_session_" + normalizeEmployeeId(employeeId);
  const raw = PropertiesService.getScriptProperties().getProperty(key) || "";
  try {
    const parsed = JSON.parse(raw);
    const value = Number(parsed.lastActivityAt || 0);
    return isNaN(value) ? 0 : value;
  } catch (e) {
    return 0;
  }
}

function setActiveSessionId(employeeId, sessionId) {
  const key = "active_session_" + normalizeEmployeeId(employeeId);
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify({
    sessionId: String(sessionId || ""),
    lastActivityAt: Date.now()
  }));
}

function touchActiveSession(employeeId, sessionId) {
  setActiveSessionId(employeeId, sessionId);
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
const IDEMPOTENT_ACTIONS = ["createParcel", "confirmReceipt", "batchConfirmReceipt", "startDelivery", "batchStartDelivery", "releaseDelivery"];
const IDEMPOTENCY_TTL_SECONDS = 21600; // 6 hours

function getIdempotencyCacheKey(action, payload) {
  if (IDEMPOTENT_ACTIONS.indexOf(action) === -1) return "";
  const rawKey = sanitizeText(payload.idempotencyKey || payload.clientRequestId || "");
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
  
  // Validate inputs
  if (!employeeId) return createJsonResponse({ success: false, error: "กรุณาระบุรหัสพนักงาน" });
  if (!pin) return createJsonResponse({ success: false, error: "กรุณาระบุรหัสผ่าน" });

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

  try {
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
  } catch (err) {
    console.error("handleLogin error: " + (err && err.stack ? err.stack : err));
    return createJsonResponse({ success: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
  }
}

function handleSetupPin(payload) {
  const employeeId = normalizeEmployeeId(payload.employeeId);
  const pin = sanitizePassword(payload.pin);
  const name = escapeSheetValue(payload.name || "");

  if (!employeeId || !pin) return createJsonResponse({ success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  if (!validateEmployeeId(employeeId)) return createJsonResponse({ success: false, error: "รหัสพนักงานไม่ถูกต้อง" });
  if (!validatePassword(pin) || pin.length > 20) return createJsonResponse({ success: false, error: "รหัสผ่านต้องมี 4-20 ตัวอักษร และห้ามขึ้นต้นด้วย = + - หรือ @" });
  if (name && name.length > 100) return createJsonResponse({ success: false, error: "ชื่อยาวเกินไป" });

  try {
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
  } catch (err) {
    console.error("handleSetupPin error: " + (err && err.stack ? err.stack : err));
    return createJsonResponse({ success: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
  }
}

// --- 70_admin_handlers.gs ---
function handleGetUsers(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบ)" });
  }
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  const users = [];

  for (let i = 1; i < data.length; i++) {
    users.push(buildUserRowResponse(data[i]));
  }
  return createJsonResponse({ success: true, users: users });
}

function handleGetSystemHealth(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบ)" });
  }

  const startedAt = Date.now();
  const checks = [];
  const metrics = {
    userCount: 0,
    activeUserCount: 0,
    parcelSheetCount: 0,
    parcelRowCount: 0,
    eventRowCount: 0
  };

  function pushCheck(name, ok, message, elapsedMs) {
    checks.push({
      name: name,
      ok: !!ok,
      message: message || "",
      elapsedMs: elapsedMs || 0
    });
  }

  const apiKeyStart = Date.now();
  const apiKeyConfigured = !!getApiKey();
  pushCheck("apiKey", apiKeyConfigured, apiKeyConfigured ? "configured" : "missing API_KEY", Date.now() - apiKeyStart);

  const adminPinStart = Date.now();
  const adminPinConfigured = !!PropertiesService.getScriptProperties().getProperty(ADMIN_INITIAL_PIN_PROPERTY);
  pushCheck("initialAdminPin", adminPinConfigured, adminPinConfigured ? "configured" : "missing ADMIN_INITIAL_PIN", Date.now() - adminPinStart);

  try {
    const sheetStart = Date.now();
    const ss = getSpreadsheet();
    pushCheck("spreadsheet", !!ss, ss ? ss.getName() : "not available", Date.now() - sheetStart);
  } catch (e) {
    pushCheck("spreadsheet", false, String(e && e.message ? e.message : e), 0);
  }

  try {
    const usersStart = Date.now();
    const usersSheet = getUsersSheet();
    const usersData = usersSheet.getDataRange().getValues();
    metrics.userCount = Math.max(0, usersData.length - 1);
    for (let i = 1; i < usersData.length; i++) {
      const status = String(usersData[i][5] || "ACTIVE").trim().toUpperCase() || "ACTIVE";
      if (status !== "DISABLED") metrics.activeUserCount++;
    }
    pushCheck("usersSheet", true, metrics.userCount + " users", Date.now() - usersStart);
  } catch (e) {
    pushCheck("usersSheet", false, String(e && e.message ? e.message : e), 0);
  }

  try {
    const parcelStart = Date.now();
    const parcelSheets = getParcelSheetsForRead();
    metrics.parcelSheetCount = parcelSheets.length;
    parcelSheets.forEach(function (entry) {
      metrics.parcelRowCount += Math.max(0, entry.sheet.getLastRow() - 1);
      const eventSheet = entry.spreadsheet.getSheetByName("ParcelEvents");
      if (eventSheet) metrics.eventRowCount += Math.max(0, eventSheet.getLastRow() - 1);
    });
    pushCheck("parcelStorage", true, metrics.parcelRowCount + " parcel rows", Date.now() - parcelStart);
  } catch (e) {
    pushCheck("parcelStorage", false, String(e && e.message ? e.message : e), 0);
  }

  try {
    const driveStart = Date.now();
    const folder = getShipTrackFolder();
    pushCheck("driveFolder", !!folder, folder ? folder.getName() : "folder not configured or unavailable", Date.now() - driveStart);
  } catch (e) {
    pushCheck("driveFolder", false, String(e && e.message ? e.message : e), 0);
  }

  const failedChecks = checks.filter(function (check) { return !check.ok; });
  return createJsonResponse({
    success: true,
    health: {
      status: failedChecks.length === 0 ? "ok" : "degraded",
      checkedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      checks: checks,
      metrics: metrics
    }
  });
}

function handleCreateUser(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบ)" });
  }

  const employeeId = normalizeEmployeeId(payload.targetId);
  const name = escapeSheetValue(payload.name);
  const newRole = normalizeRole(payload.newRole);
  const password = sanitizePassword(payload.password);

  if (!employeeId || !name || !newRole || !password) {
    return createJsonResponse({ success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  }
  if (!validateEmployeeId(employeeId)) return createJsonResponse({ success: false, error: "รหัสพนักงานไม่ถูกต้อง" });
  if (VALID_ROLES.indexOf(newRole) === -1) return createJsonResponse({ success: false, error: "สิทธิ์ไม่ถูกต้อง" });
  if (!validatePassword(password) || password.length > 100) {
    return createJsonResponse({ success: false, error: "รหัสผ่านต้องมี 4-100 ตัวอักษร และห้ามขึ้นต้นด้วย = + - หรือ @" });
  }
  if (name.length > 100) return createJsonResponse({ success: false, error: "ชื่อยาวเกินไป" });

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (normalizeEmployeeId(data[i][0]) === employeeId) {
      return createJsonResponse({ success: false, error: "รหัสพนักงานนี้มีอยู่แล้ว" });
    }
  }

  const createdAt = formatThaiDateForSheet(new Date());
  sheet.appendRow([employeeId, name, newRole, encodePassword(password), createdAt, "ACTIVE", createdAt]);
  writeAuditLog(payload.employeeId, "createUser", employeeId, "role=" + newRole);

  return createJsonResponse({
    success: true,
    user: {
      employeeId: employeeId,
      name: name,
      role: newRole,
      hasPin: true,
      createdAt: createdAt,
      status: "ACTIVE",
      updatedAt: createdAt
    }
  });
}

function handleUpdateUserRole(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบ)" });
  }

  const targetId = normalizeEmployeeId(payload.targetId);
  const newRole = normalizeRole(payload.newRole);
  if (!targetId || !newRole) return createJsonResponse({ success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  if (!validateEmployeeId(targetId)) return createJsonResponse({ success: false, error: "รหัสพนักงานไม่ถูกต้อง" });
  if (VALID_ROLES.indexOf(newRole) === -1) {
    return createJsonResponse({ success: false, error: "สิทธิ์ไม่ถูกต้อง" });
  }
  if (targetId === normalizeEmployeeId(payload.employeeId) && newRole !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "ไม่สามารถลดสิทธิ์ของตัวเองได้" });
  }

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (normalizeEmployeeId(data[i][0]) === targetId) {
      if (normalizeRole(data[i][2] || "GUEST") === "ADMIN" && newRole !== "ADMIN" && countActiveAdmins(data) <= 1) {
        return createJsonResponse({ success: false, error: "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน" });
      }
      sheet.getRange(i + 1, 3).setValue(newRole);
      sheet.getRange(i + 1, 7).setValue(formatThaiDateForSheet(new Date()));
      setActiveSessionId(targetId, "");
      return createJsonResponse({ success: true });
    }
  }
  return createJsonResponse({ success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
}

function countActiveAdmins(data) {
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    const role = normalizeRole(data[i][2] || "GUEST");
    const status = String(data[i][5] || "ACTIVE").trim().toUpperCase() || "ACTIVE";
    if (role === "ADMIN" && status !== "DISABLED") count++;
  }
  return count;
}

function buildUserRowResponse(row) {
  return {
    employeeId: normalizeEmployeeId(row[0]),
    name: String(row[1] || ""),
    role: normalizeRole(row[2] || "GUEST"),
    hasPin: !!String(row[3] || "").trim(),
    createdAt: formatSheetDateValue(row[4]),
    status: String(row[5] || "ACTIVE").trim().toUpperCase() || "ACTIVE",
    updatedAt: formatSheetDateValue(row[6])
  };
}

function handleUpdateUser(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบ)" });
  }

  const targetId = normalizeEmployeeId(payload.targetId);
  const name = escapeSheetValue(payload.name);
  const newRole = normalizeRole(payload.newRole);
  const password = payload.password ? sanitizePassword(payload.password) : "";
  if (!targetId || !name || !newRole) return createJsonResponse({ success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  if (!validateEmployeeId(targetId)) return createJsonResponse({ success: false, error: "รหัสพนักงานไม่ถูกต้อง" });
  if (VALID_ROLES.indexOf(newRole) === -1) return createJsonResponse({ success: false, error: "สิทธิ์ไม่ถูกต้อง" });
  if (name.length > 100) return createJsonResponse({ success: false, error: "ชื่อยาวเกินไป" });
  if (password && (!validatePassword(password) || password.length > 100)) {
    return createJsonResponse({ success: false, error: "รหัสผ่านต้องมี 4-100 ตัวอักษร และห้ามขึ้นต้นด้วย = + - หรือ @" });
  }

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (normalizeEmployeeId(data[i][0]) === targetId) {
      if (targetId === normalizeEmployeeId(payload.employeeId) && newRole !== 'ADMIN') {
        return createJsonResponse({ success: false, error: "ไม่สามารถลดสิทธิ์ของตัวเองได้" });
      }
      if (normalizeRole(data[i][2] || "GUEST") === "ADMIN" && newRole !== "ADMIN" && countActiveAdmins(data) <= 1) {
        return createJsonResponse({ success: false, error: "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน" });
      }
      const updatedAt = formatThaiDateForSheet(new Date());
      sheet.getRange(i + 1, 2).setValue(name);
      sheet.getRange(i + 1, 3).setValue(newRole);
      if (password) {
        sheet.getRange(i + 1, 4).setValue(encodePassword(password));
        setActiveSessionId(targetId, "");
      }
      sheet.getRange(i + 1, 7).setValue(updatedAt);
      const row = sheet.getRange(i + 1, 1, 1, USER_HEADERS.length).getValues()[0];
      writeAuditLog(payload.employeeId, "UPDATE_USER", targetId, "role=" + newRole);
      return createJsonResponse({ success: true, user: buildUserRowResponse(row) });
    }
  }
  return createJsonResponse({ success: false, error: "ไม่พบผู้ใช้" });
}

function handleDisableUser(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบ)" });
  }
  const targetId = normalizeEmployeeId(payload.targetId);
  if (!targetId || !validateEmployeeId(targetId)) return createJsonResponse({ success: false, error: "รหัสพนักงานไม่ถูกต้อง" });
  if (targetId === normalizeEmployeeId(payload.employeeId)) return createJsonResponse({ success: false, error: "ไม่สามารถปิดบัญชีของตัวเองได้" });

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (normalizeEmployeeId(data[i][0]) === targetId) {
      if (normalizeRole(data[i][2] || "GUEST") === "ADMIN" && countActiveAdmins(data) <= 1) {
        return createJsonResponse({ success: false, error: "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน" });
      }
      const updatedAt = formatThaiDateForSheet(new Date());
      sheet.getRange(i + 1, 6).setValue("DISABLED");
      sheet.getRange(i + 1, 7).setValue(updatedAt);
      setActiveSessionId(targetId, "");
      const row = sheet.getRange(i + 1, 1, 1, USER_HEADERS.length).getValues()[0];
      writeAuditLog(payload.employeeId, "DISABLE_USER", targetId, "");
      return createJsonResponse({ success: true, user: buildUserRowResponse(row) });
    }
  }
  return createJsonResponse({ success: false, error: "ไม่พบผู้ใช้" });
}

function handleDeleteUser(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบ)" });
  }
  const targetId = normalizeEmployeeId(payload.targetId);
  if (!targetId || !validateEmployeeId(targetId)) return createJsonResponse({ success: false, error: "รหัสพนักงานไม่ถูกต้อง" });
  if (targetId === normalizeEmployeeId(payload.employeeId)) return createJsonResponse({ success: false, error: "ไม่สามารถลบบัญชีของตัวเองได้" });

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (normalizeEmployeeId(data[i][0]) === targetId) {
      if (normalizeRole(data[i][2] || "GUEST") === "ADMIN" && countActiveAdmins(data) <= 1) {
        return createJsonResponse({ success: false, error: "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน" });
      }
      sheet.deleteRow(i + 1);
      setActiveSessionId(targetId, "");
      writeAuditLog(payload.employeeId, "DELETE_USER", targetId, "");
      return createJsonResponse({ success: true });
    }
  }
  return createJsonResponse({ success: false, error: "ไม่พบผู้ใช้" });
}

function handleGetBranches(payload) {
  if (!hasAnyRole(payload, ["ADMIN", "MESSENGER", "GUEST"])) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }
  return createJsonResponse({ success: true, branches: readBranches() });
}

function handleCreateBranch(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบ)" });
  }
  const name = escapeSheetValue(payload.name || "");
  if (!name) return createJsonResponse({ success: false, error: "กรุณากรอกชื่อแผนก/สาขา" });
  if (name.length > 100) return createJsonResponse({ success: false, error: "ชื่อแผนก/สาขายาวเกินไป" });

  const sheet = getBranchesSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || "").trim().toLowerCase() === name.toLowerCase()) {
      return createJsonResponse({ success: false, error: "มีแผนก/สาขานี้แล้ว" });
    }
  }
  sheet.appendRow([name, formatThaiDateForSheet(new Date()), payload.employeeId || ""]);
  writeAuditLog(payload.employeeId, "CREATE_BRANCH", name, "");
  return createJsonResponse({ success: true, branches: readBranches() });
}

function handleDeleteBranch(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบ)" });
  }
  const name = escapeSheetValue(payload.name || "");
  if (!name) return createJsonResponse({ success: false, error: "กรุณาระบุแผนก/สาขา" });

  const sheet = getBranchesSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0] || "").trim().toLowerCase() === name.toLowerCase()) {
      sheet.deleteRow(i + 1);
      writeAuditLog(payload.employeeId, "DELETE_BRANCH", name, "");
      return createJsonResponse({ success: true, branches: readBranches() });
    }
  }
  return createJsonResponse({ success: false, error: "ไม่พบแผนก/สาขา" });
}

function handleRenameBranch(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบ)" });
  }
  const oldName = escapeSheetValue(payload.oldName || "");
  const newName = escapeSheetValue(payload.newName || "");
  if (!oldName || !newName) return createJsonResponse({ success: false, error: "กรุณาระบุชื่อเดิมและชื่อใหม่" });
  if (newName.length > 100) return createJsonResponse({ success: false, error: "ชื่อแผนก/สาขายาวเกินไป" });

  const sheet = getBranchesSheet();
  const data = sheet.getDataRange().getValues();
  let foundIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || "").trim().toLowerCase() === newName.toLowerCase()) {
      return createJsonResponse({ success: false, error: "มีแผนก/สาขาชื่อใหม่นี้แล้ว" });
    }
    if (String(data[i][0] || "").trim().toLowerCase() === oldName.toLowerCase()) {
      foundIndex = i;
    }
  }

  if (foundIndex === -1) {
    return createJsonResponse({ success: false, error: "ไม่พบแผนก/สาขาเดิม" });
  }

  sheet.getRange(foundIndex + 1, 1).setValue(newName);
  sheet.getRange(foundIndex + 1, 2).setValue(formatThaiDateForSheet(new Date()));
  sheet.getRange(foundIndex + 1, 3).setValue(payload.employeeId || "");

  writeAuditLog(payload.employeeId, "RENAME_BRANCH", oldName, "newName=" + newName);

  return createJsonResponse({ success: true, branches: readBranches() });
}

function handleDeleteParcel(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบ)" });
  }

  const trackingID = String(payload.trackingID || "").trim();
  if (!trackingID) return createJsonResponse({ success: false, error: "กรุณาระบุหมายเลขติดตาม" });
  if (!validateTrackingID(trackingID)) return createJsonResponse({ success: false, error: "รูปแบบหมายเลขติดตามไม่ถูกต้อง" });

  const storage = getParcelStorageByTrackingId(trackingID);
  if (!storage) return createJsonResponse({ success: false, error: "ไม่พบรายการส่งที่ระบุ" });
  const sheet = storage.sheet;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === trackingID) {
      const parcelInfo = "ผู้ส่ง:" + data[i][2] + " ผู้รับ:" + data[i][4];
      sheet.deleteRow(i + 1);
      const eventSheet = getEventSheetForSpreadsheet(storage.spreadsheet);
      if (eventSheet) {
        const eventData = eventSheet.getDataRange().getValues();
        for (let j = eventData.length - 1; j >= 1; j--) {
          if (String(eventData[j][1]).trim() === trackingID) {
            eventSheet.deleteRow(j + 1);
          }
        }
      }
      writeAuditLog(payload.employeeId, "DELETE_PARCEL", trackingID, parcelInfo);
      return createJsonResponse({ success: true });
    }
  }
  return createJsonResponse({ success: false, error: "ไม่พบรายการส่งที่ระบุ" });
}

function handleEditParcel(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบ)" });
  }

  const trackingID = String(payload.trackingID || "").trim();
  const updates = payload.updates;
  if (!trackingID || !updates) return createJsonResponse({ success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  if (!validateTrackingID(trackingID)) return createJsonResponse({ success: false, error: "รูปแบบหมายเลขติดตามไม่ถูกต้อง" });

  // Validate update values
  const allowedFields = ["senderName", "senderBranch", "receiverName", "receiverBranch", "description"];
  const fieldMap = { senderName: "ผู้ส่ง", senderBranch: "สาขาผู้ส่ง", receiverName: "ผู้รับ", receiverBranch: "สาขาผู้รับ", description: "รายละเอียด" };
  for (const key of Object.keys(updates)) {
    if (!allowedFields.includes(key)) return createJsonResponse({ success: false, error: "ฟิลด์ไม่ถูกต้อง: " + key });
    if (typeof updates[key] !== 'string' || updates[key].length > 200) return createJsonResponse({ success: false, error: "ค่าไม่ถูกต้องสำหรับฟิลด์: " + key });
    updates[key] = escapeSheetValue(updates[key]);
  }

  const storage = getParcelStorageByTrackingId(trackingID);
  if (!storage) return createJsonResponse({ success: false, error: "ไม่พบรายการส่งที่ระบุ" });
  const sheet = storage.sheet;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === trackingID) {
      const rowIndex = i + 1;
      const changedFields = [];
      for (const key of allowedFields) {
        if (updates[key]) {
          const colName = fieldMap[key];
          const colIdx = headers.indexOf(colName);
          if (colIdx >= 0) {
            sheet.getRange(rowIndex, colIdx + 1).setValue(updates[key]);
            changedFields.push(key + "=" + updates[key]);
          }
        }
      }
      writeAuditLog(payload.employeeId, "EDIT_PARCEL", trackingID, changedFields.join(", "));
      return createJsonResponse({ success: true });
    }
  }
  return createJsonResponse({ success: false, error: "ไม่พบรายการส่งที่ระบุ" });
}

function handleUpdateProfile(payload) {
  // Any authenticated user can update their own profile
  if (!hasAnyRole(payload, ['ADMIN', 'MESSENGER'])) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }

  const employeeId = normalizeEmployeeId(payload.employeeId);
  if (!employeeId) return createJsonResponse({ success: false, error: "Missing employeeId" });

  const newName = payload.newName ? escapeSheetValue(payload.newName) : null;
  const newPassword = payload.newPassword ? sanitizePassword(payload.newPassword) : null;
  const currentPassword = payload.currentPassword ? sanitizePassword(payload.currentPassword) : null;

  // Validate lengths
  if (newName && newName.length > 200) return createJsonResponse({ success: false, error: "ชื่อยาวเกินไป" });
  if (newPassword && !validatePassword(newPassword)) return createJsonResponse({ success: false, error: "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร และห้ามขึ้นต้นด้วย = + - หรือ @" });
  if (newPassword && newPassword.length > 100) return createJsonResponse({ success: false, error: "รหัสผ่านยาวเกินไป" });

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (normalizeEmployeeId(data[i][0]) !== employeeId) continue;

    const rowIndex = i + 1;
    const currentPin = String(data[i][3] || "").trim();

    // If changing password, must verify current password first
    if (newPassword) {
      if (!currentPassword) return createJsonResponse({ success: false, error: "กรุณากรอกรหัสผ่านปัจจุบันเพื่อเปลี่ยนรหัสผ่าน" });
      const passwordCheck = verifyPasswordRecord(currentPin, currentPassword);
      if (!passwordCheck.ok) return createJsonResponse({ success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
      if (passwordCheck.needsMigration) {
        sheet.getRange(rowIndex, 4).setValue(encodePassword(currentPassword));
      }
    }

    const changedFields = [];
    if (newName) {
      sheet.getRange(rowIndex, 2).setValue(newName);
      changedFields.push("name=" + newName);
    }
    if (newPassword) {
      sheet.getRange(rowIndex, 4).setValue(encodePassword(newPassword));
      changedFields.push("password=***");
    }

    if (changedFields.length === 0) return createJsonResponse({ success: false, error: "ไม่มีข้อมูลที่ต้องการแก้ไข" });

    writeAuditLog(employeeId, "UPDATE_PROFILE", employeeId, changedFields.join(", "));

    // Return updated user info (without password)
    const updatedName = newName || String(data[i][1] || "").trim();
    const role = normalizeRole(data[i][2] || "GUEST");
    const issuedAt = Date.now();
    const token = generateToken(employeeId, role, getApiKey(), issuedAt);

    return createJsonResponse({
      success: true,
      user: { employeeId, name: updatedName, role, token, issuedAt }
    });
  }

  return createJsonResponse({ success: false, error: "ไม่พบผู้ใช้งาน" });
}

// --- 99_options.gs ---
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
