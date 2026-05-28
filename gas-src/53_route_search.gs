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
