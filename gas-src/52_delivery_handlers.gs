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
