function doPost(e) {
  try {
    const rawBody = e && e.postData && e.postData.contents ? String(e.postData.contents) : "";
    if (!rawBody || rawBody.length > MAX_REQUEST_LENGTH) {
      return createJsonResponse({ success: false, error: "Invalid request size" });
    }
    const payload = JSON.parse(rawBody);
    const action = payload.action;
    const configuredKey = getApiKey();
    if (!configuredKey) {
      return createJsonResponse({ success: false, error: "API key is not configured on script properties" });
    }
    if (payload.apiKey !== configuredKey) {
      return createJsonResponse({ success: false, error: "Unauthorized" });
    }

    // --- Token Signature Verification ---
    const protectedActions = ['confirmReceipt', 'batchConfirmReceipt', 'startDelivery', 'batchStartDelivery', 'releaseDelivery', 'syncRouteSamples', 'getParcels', 'exportSummary', 'getUsers', 'createUser', 'updateUserRole', 'updateUser', 'disableUser', 'deleteUser', 'createBranch', 'deleteBranch', 'renameBranch', 'deleteParcel', 'editParcel', 'updateProfile', 'getAuditLogs', 'getParcelActivityLogs'];
    if (payload.token) {
      const parts = String(payload.token).split('|');
      if (parts.length === 5) {
        const issuedAt = Number(parts[2]);
        if (isNaN(issuedAt)) {
          return createJsonResponse({ success: false, error: "Malformed token" });
        }
        if (Date.now() - issuedAt > TOKEN_MAX_AGE_MS) {
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
      if (protectedActions.includes(action)) {
        return createJsonResponse({ success: false, error: "Authentication required (Missing Token)" });
      }
      payload.role = 'GUEST';
    }

    const writeActions = ['createParcel', 'confirmReceipt', 'batchConfirmReceipt', 'startDelivery', 'batchStartDelivery', 'releaseDelivery', 'syncRouteSamples', 'login', 'setupPin', 'createUser', 'updateUserRole', 'updateUser', 'disableUser', 'deleteUser', 'createBranch', 'deleteBranch', 'renameBranch', 'deleteParcel', 'editParcel', 'updateProfile'];
    const isWrite = writeActions.includes(action);

    let result;
    if (isWrite) {
      const lock = LockService.getScriptLock();
      let locked = false;
      try {
        locked = lock.tryLock(30000);
        if (!locked) {
          return createJsonResponse({ success: false, error: "ระบบไม่ว่าง กรุณาลองใหม่อีกครั้ง (Lock timeout)" });
        }
        const cachedResult = getCachedIdempotentResponse(action, payload);
        if (cachedResult) return cachedResult;
        result = routeAction(action, payload);
        storeIdempotentResponse(action, payload, result);
      } finally {
        if (locked) lock.releaseLock();
      }
    } else {
      result = routeAction(action, payload);
    }

    if (result) return result;

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
  if (action === 'syncRouteSamples') return handleSyncRouteSamples(payload);
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
  if (action === 'deleteParcel') return handleDeleteParcel(payload);
  if (action === 'editParcel') return handleEditParcel(payload);
  if (action === 'updateProfile') return handleUpdateProfile(payload);
  return null;
}

function doGet() {
  // Return minimal response — don't expose service details publicly
  return createJsonResponse({ success: true });
}
