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
