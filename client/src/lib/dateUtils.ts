/**
 * Date Utilities for Thai Language
 */

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_MONTH_INDEX = new Map(THAI_MONTHS.map((month, index) => [month, index]));

export function parseDateInput(dateStr: string): Date | null {
  if (!dateStr) return null;

  const text = dateStr.trim();
  const thaiMatch = text.match(/^(\d{1,2})\s+([^\s]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (thaiMatch) {
    const [, dayText, monthText, yearText, hourText, minuteText] = thaiMatch;
    const monthIndex = THAI_MONTH_INDEX.get(monthText);
    if (monthIndex !== undefined) {
      const buddhistOrChristianYear = Number(yearText);
      const year = buddhistOrChristianYear > 2400 ? buddhistOrChristianYear - 543 : buddhistOrChristianYear;
      const date = new Date(
        year,
        monthIndex,
        Number(dayText),
        hourText ? Number(hourText) : 0,
        minuteText ? Number(minuteText) : 0,
      );
      return isNaN(date.getTime()) ? null : date;
    }
  }

  const date = new Date(text.replace(' ', 'T'));
  return isNaN(date.getTime()) ? null : date;
}

export function getDateTime(dateStr: string): number {
  return parseDateInput(dateStr)?.getTime() ?? 0;
}

/**
 * Format date string to Thai long format: 27 เมษายน 2569
 * @param dateStr ISO date string or date-time string
 * @returns Formatted Thai date string
 */
export function formatThaiDate(dateStr: string): string {
  if (!dateStr) return '-';
  
  try {
    const date = parseDateInput(dateStr);
    
    if (!date) return dateStr;

    const day = date.getDate();
    const month = THAI_MONTHS[date.getMonth()];
    const year = date.getFullYear() + 543; // Convert to Buddhist Era

    return `${day} ${month} ${year}`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * Format date-time values with the app-wide Thai date and time format.
 */
export function formatThaiDateTime(dateStr: string): string {
  if (!dateStr) return '-';

  try {
    const hasExplicitTime = /\d{1,2}:\d{2}/.test(dateStr);
    const date = parseDateInput(dateStr);

    if (!date) return dateStr;
    if (!hasExplicitTime) return formatThaiDate(dateStr);

    const day = date.getDate();
    const month = THAI_MONTHS[date.getMonth()];
    const year = date.getFullYear() + 543;
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');

    return `${day} ${month} ${year} ${hour}:${minute} น.`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * Format a date/ISO string to a short Thai time string (HH:MM).
 * Returns '-' for null/invalid input.
 */
export function formatSyncTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}
