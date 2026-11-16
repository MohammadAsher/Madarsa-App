/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const DEFAULT_SCHOOL_TIMEZONE = 'Asia/Karachi';

export const SCHOOL_TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Asia/Karachi', label: 'Asia/Karachi (PKT)' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (AST)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'Asia/Dhaka', label: 'Asia/Dhaka (BST)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Asia/Kuala_Lumpur (MYT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'America/New_York', label: 'America/New_York (ET)' },
  { value: 'America/Chicago', label: 'America/Chicago (CT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AET)' },
];

/**
 * Returns the real current calendar date (YYYY-MM-DD) in the school's time zone.
 * Defaults to Asia/Karachi.
 */
export function getRealTodayDate(
  timeZone: string = DEFAULT_SCHOOL_TIMEZONE,
  now: Date = new Date()
): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fallback to Asia/Karachi if an invalid timeZone string is supplied
    if (timeZone !== DEFAULT_SCHOOL_TIMEZONE) {
      return getRealTodayDate(DEFAULT_SCHOOL_TIMEZONE, now);
    }
  }

  // Final UTC-safe fallback
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Shifts a YYYY-MM-DD calendar date by `deltaDays` without local timezone drift.
 */
export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(n => parseInt(n, 10));
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Returns the real tomorrow date (YYYY-MM-DD) in the school's time zone.
 */
export function getRealTomorrowDate(
  timeZone: string = DEFAULT_SCHOOL_TIMEZONE,
  now: Date = new Date()
): string {
  return shiftIsoDate(getRealTodayDate(timeZone, now), 1);
}
