/**
 * Time formatting helpers. Every formatter pins the timeZone explicitly so
 * server-rendered HTML matches the client (no hydration mismatches) and the
 * dashboard always shows Sri Lankan local time.
 */

const TZ = 'Asia/Colombo'

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dayTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: '2-digit',
  month: 'short',
})

/** "14:30" */
export function formatTime(input: string | number | Date): string {
  return timeFmt.format(new Date(input))
}

/** "13 Oct, 14:30" */
export function formatDateTime(input: string | number | Date): string {
  return dateTimeFmt.format(new Date(input))
}

/** "Tue 14:30" for chart axis labels */
export function formatDayTime(input: string | number | Date): string {
  return dayTimeFmt.format(new Date(input))
}

/** "13 Oct" for chart axis labels */
export function formatDay(input: string | number | Date): string {
  return dateFmt.format(new Date(input))
}
