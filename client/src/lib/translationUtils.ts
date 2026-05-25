/**
 * Translation Utilities
 * แปลข้อความหมายเหตุระบบ (system-generated notes) ให้เป็นภาษาไทยที่อ่านเข้าใจง่าย
 */

/** แปลค่า action ของ AuditLog เป็นภาษาไทย */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE_PARCEL: 'สร้างรายการส่ง',
  CONFIRM_RECEIPT: 'ยืนยันการส่ง',
  START_DELIVERY: 'รับงานจัดส่ง',
  RELEASE_DELIVERY: 'คืนงานจัดส่ง',
  CREATE_USER: 'สร้างผู้ใช้',
  UPDATE_USER: 'แก้ไขผู้ใช้',
  DISABLE_USER: 'ระงับผู้ใช้',
  DELETE_USER: 'ลบผู้ใช้',
  CREATE_BRANCH: 'สร้างสาขา',
  DELETE_BRANCH: 'ลบสาขา',
  DELETE_PARCEL: 'ลบรายการส่ง',
  EDIT_PARCEL: 'แก้ไขรายการส่ง',
  UPDATE_PROFILE: 'อัปเดตโปรไฟล์',
  LOGIN_BLOCKED: 'บล็อกการเข้าสู่ระบบ',
};

/**
 * แปลหมายเหตุระบบอัตโนมัติให้เป็นภาษาไทยที่อ่านง่าย
 *
 * รูปแบบที่รองรับ:
 *  - "autoPickup=originGpsMatched;distanceMeters=123"
 *  - "assignedToId=user123"
 *  - "[GPS: ...]" tags
 *  - ข้อความทั่วไปจะคืนค่าเดิม
 */
export function translateSystemNote(raw: string | null | undefined): string {
  if (!raw) return '';
  let text = raw;

  // แปล autoPickup patterns
  text = text.replace(
    /autoPickup=originGpsMatched;distanceMeters=(\d+(?:\.\d+)?)/gi,
    (_match, meters) => {
      const m = parseFloat(meters);
      const dist = m >= 1000 ? `${(m / 1000).toFixed(1)} กม.` : `${Math.round(m)} ม.`;
      return `รับของอัตโนมัติ (GPS ตรงกับต้นทาง ห่าง ${dist})`;
    },
  );

  text = text.replace(
    /autoPickup=originGpsMatched/gi,
    'รับของอัตโนมัติ (GPS ตรงกับต้นทาง)',
  );

  text = text.replace(
    /autoPickup=(\w+)/gi,
    (_match, reason) => `รับของอัตโนมัติ (${reason})`,
  );

  // แปล assignedToId
  text = text.replace(
    /assignedToId=(\S+)/gi,
    (_match, userId) => `มอบหมายให้: ${userId}`,
  );

  // แปล GPS evidence tags เช่น [GPS: ...]
  text = text.replace(
    /\[GPS:\s*matched,?\s*distance\s*(\d+(?:\.\d+)?)m?\]/gi,
    (_match, meters) => {
      const m = parseFloat(meters);
      const dist = m >= 1000 ? `${(m / 1000).toFixed(1)} กม.` : `${Math.round(m)} ม.`;
      return `[ตำแหน่ง GPS ตรงกัน ห่าง ${dist}]`;
    },
  );

  text = text.replace(
    /\[GPS:\s*no_match,?\s*distance\s*(\d+(?:\.\d+)?)m?\]/gi,
    (_match, meters) => {
      const m = parseFloat(meters);
      const dist = m >= 1000 ? `${(m / 1000).toFixed(1)} กม.` : `${Math.round(m)} ม.`;
      return `[ตำแหน่ง GPS ไม่ตรง ห่าง ${dist}]`;
    },
  );

  text = text.replace(
    /\[GPS:\s*unavailable\]/gi,
    '[ไม่มีข้อมูลตำแหน่ง GPS]',
  );

  text = text.replace(
    /\[GPS:\s*bypassed(?:,?\s*reason:\s*(.+?))?\]/gi,
    (_match, reason) => reason ? `[ข้าม GPS: ${reason}]` : '[ข้ามตำแหน่ง GPS]',
  );

  // แปล delivery match status tags
  text = text.replace(/deliveryMatch=MATCHED_DECLARED_DESTINATION/gi, 'ส่งตรงตามปลายทาง');
  text = text.replace(/deliveryMatch=DELIVERED_ELSEWHERE/gi, 'ส่งคนละจุด');

  // แปล forwarding tags
  text = text.replace(
    /forwardedFrom=(\S+)\s+to=(\S+)/gi,
    (_match, from, to) => `ส่งต่อจาก ${from} ไปยัง ${to}`,
  );

  // แปล proxy tags
  text = text.replace(
    /proxyReceiver=(\S+)/gi,
    (_match, name) => `ผู้รับแทน: ${name}`,
  );

  return text.trim();
}

/**
 * แปลรายละเอียดของ AuditLog ให้เป็นภาษาไทย
 */
export function translateAuditDetails(details: string | null | undefined): string {
  if (!details) return '';
  let text = details;

  // Common field translations
  text = text.replace(/status\s*[:=]\s*/gi, 'สถานะ: ');
  text = text.replace(/sender\s*[:=]\s*/gi, 'ผู้ส่ง: ');
  text = text.replace(/receiver\s*[:=]\s*/gi, 'ผู้รับ: ');
  text = text.replace(/branch\s*[:=]\s*/gi, 'สาขา: ');
  text = text.replace(/role\s*[:=]\s*/gi, 'ตำแหน่ง: ');
  text = text.replace(/reason\s*[:=]\s*/gi, 'เหตุผล: ');

  return text.trim();
}
