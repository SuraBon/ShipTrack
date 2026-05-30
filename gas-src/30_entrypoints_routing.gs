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
