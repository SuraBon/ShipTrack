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
