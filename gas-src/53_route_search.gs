function sanitizeRouteSampleId(value) {
  return String(value || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
}

function handleSyncRouteSamples(payload) {
  if (!hasAnyRole(payload, ['ADMIN', 'MESSENGER'])) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }

  const reqId = sanitizeText(payload.requestId || "");

  const rl = checkWriteRateLimit(payload.employeeId, 'syncRouteSamples');
  if (!rl.allowed) {
    return createJsonResponse({ success: false, error: "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" });
  }

  if (!validateTrackingID(payload.trackingID)) {
    return createJsonResponse({ success: false, error: "รูปแบบหมายเลขติดตามไม่ถูกต้อง" });
  }

  const samples = Array.isArray(payload.samples) ? payload.samples.slice(0, 500) : [];
  if (samples.length === 0) {
    return createJsonResponse({ success: true, savedCount: 0, skippedCount: 0 });
  }

  const storage = getParcelStorageByTrackingId(payload.trackingID);
  if (!storage) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }

  const data = storage.sheet.getDataRange().getValues();
  let parcelRow = null;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(payload.trackingID).trim()) {
      parcelRow = data[i];
      break;
    }
  }

  if (!parcelRow || !canReadParcelRow(payload, parcelRow)) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }

  const routeSheet = getRouteSampleSheetForSpreadsheet(storage.spreadsheet);
  if (!routeSheet) {
    return createJsonResponse({ success: false, error: "Route sample sheet unavailable" });
  }

  const existingIds = {};
  const existingSamples = getRouteSamplesForSpreadsheet(storage.spreadsheet, payload.trackingID);
  for (let i = 0; i < existingSamples.length; i++) {
    existingIds[String(existingSamples[i].id)] = true;
  }

  let savedCount = 0;
  let skippedCount = 0;
  const rowsToAppend = [];
  const operatorName = escapeSheetValue(payload.operatorName || payload.name || payload.employeeId || "");
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i] || {};
    const sampleId = sanitizeRouteSampleId(sample.id || (String(payload.trackingID) + "_" + i));
    if (!sampleId) {
      skippedCount++;
      continue;
    }

    if (existingIds[sampleId]) {
      skippedCount++;
      continue;
    }

    const latitude = sanitizeCoordinate(sample.latitude, -90, 90);
    const longitude = sanitizeCoordinate(sample.longitude, -180, 180);
    if (latitude === "" || longitude === "") {
      skippedCount++;
      continue;
    }

    const rawDate = sample.timestamp ? new Date(String(sample.timestamp)) : new Date();
    const eventDate = isNaN(rawDate.getTime()) ? new Date() : rawDate;
    rowsToAppend.push([
      sampleId,
      payload.trackingID,
      formatThaiDateForSheet(eventDate),
      latitude,
      longitude,
      sample.accuracy !== undefined && sample.accuracy !== null && isFinite(Number(sample.accuracy)) ? Math.round(Number(sample.accuracy)) : "",
      sample.speed !== undefined && sample.speed !== null && isFinite(Number(sample.speed)) ? Number(sample.speed).toFixed(2) : "",
      sample.heading !== undefined && sample.heading !== null && isFinite(Number(sample.heading)) ? Math.round(Number(sample.heading)) : "",
      operatorName,
      formatThaiDateForSheet(new Date())
    ]);
    existingIds[sampleId] = true;
    savedCount++;
  }

  if (rowsToAppend.length > 0) {
    routeSheet
      .getRange(routeSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length)
      .setValues(rowsToAppend);
  }

  if (savedCount > 0) {
    const details = "Saved route samples: " + savedCount +
      (skippedCount ? " (skipped: " + skippedCount + ")" : "") +
      (reqId ? " requestId=" + reqId : "");
    writeAuditLog(payload.employeeId, "SYNC_ROUTE_SAMPLES", payload.trackingID, details);
  }
  return createJsonResponse({ success: true, savedCount: savedCount, skippedCount: skippedCount });
}

/**
 * Time-driven maintenance: delete route samples older than daysToKeep (default 90).
 * Install trigger: daily, function purgeOldRouteSamples
 */
function purgeOldRouteSamples(daysToKeep) {
  const keepDays = Math.max(parseInt(daysToKeep) || 90, 7);
  const cutoffMs = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  let deleted = 0;

  getYearSpreadsheetsForRead().forEach(function (entry) {
    const sheet = entry.spreadsheet.getSheetByName("RouteSamples");
    if (!sheet || sheet.getLastRow() <= 1) return;
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      const ts = row[2];
      const parsed = ts instanceof Date ? ts.getTime() : Date.parse(String(ts || ""));
      if (!isNaN(parsed) && parsed < cutoffMs) {
        sheet.deleteRow(i + 1);
        deleted++;
      }
    }
  });

  writeAuditLog("SYSTEM", "PURGE_ROUTE_SAMPLES", "", "Deleted rows: " + deleted + " older than " + keepDays + " days");
  return { success: true, deleted: deleted };
}

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
    // Attach events only for authenticated users. Public search should not expose proof images or GPS trails.
    const trackingIds = parcels.map(function (p) { return p.TrackingID; });
    const eventsMap = getEventsForTrackingIds(trackingIds);
    const routeSamplesMap = getRouteSamplesForTrackingIds(trackingIds);
    for (let p of parcels) {
      p.events = eventsMap[p.TrackingID] || [];
      p.routeSamples = routeSamplesMap[p.TrackingID] || [];
    }
  }

  return createJsonResponse({ success: true, parcels: parcels });
}
