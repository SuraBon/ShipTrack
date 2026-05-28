function handleCreateParcel(payload) {
  if (!hasAnyRole(payload, ['ADMIN', 'MESSENGER', 'GUEST'])) {
    return createJsonResponse({ success: false, error: "ไม่มีสิทธิ์เข้าถึง" });
  }

  // Rate limit: ป้องกัน spam สร้างพัสดุ
  const clientId = sanitizeText(payload.clientId || "");
  const actorId = payload.employeeId || (clientId ? "guest:" + clientId : "guest");
  const rl = checkWriteRateLimit(actorId, 'createParcel');
  if (!rl.allowed) {
    return createJsonResponse({ success: false, error: "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" });
  }
  if (!payload.senderName || !payload.senderBranch || !payload.receiverName || !payload.receiverBranch || !payload.description) {
    return createJsonResponse({ success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
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
  } catch (e) {
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
