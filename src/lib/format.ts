/**
 * Time formatting helpers. Every formatter pins the timeZone explicitly so
 * server-rendered HTML matches the client (no hydration mismatches) and the
 * dashboard always shows Sri Lankan local time. Pass the active Lingui
 * locale (`i18n.locale`) to get month/day names in that language.
 *
 * Sinhala names come from a built-in table rather than Intl: Chrome ships
 * without Sinhala locale data, so `Intl` with "si-LK" silently falls back to
 * English in the browser while Node formats it in Sinhala — a guaranteed
 * hydration mismatch.
 */

const TZ = 'Asia/Colombo'

type DateInput = string | number | Date

const enFmt = {
  time: new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }),
  dateTime: new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }),
  dayTime: new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }),
  date: new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
  }),
}

const SI_MONTHS = [
  'ජන',
  'පෙබ',
  'මාර්තු',
  'අප්‍රේල්',
  'මැයි',
  'ජූනි',
  'ජූලි',
  'අගෝ',
  'සැප්',
  'ඔක්',
  'නොවැ',
  'දෙසැ',
]
const SI_WEEKDAYS = ['ඉරිදා', 'සඳුදා', 'අඟහ', 'බදාදා', 'බ්‍රහස්', 'සිකු', 'සෙන']
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  weekday: 'short',
  day: '2-digit',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Colombo-local date parts with Sinhala month/weekday names */
function siParts(input: DateInput) {
  const parts: Record<string, string> = {}
  for (const p of partsFmt.formatToParts(new Date(input))) {
    parts[p.type] = p.value
  }
  return {
    month: SI_MONTHS[Number(parts.month) - 1] ?? '',
    weekday: SI_WEEKDAYS[EN_WEEKDAYS.indexOf(parts.weekday ?? '')] ?? '',
    day: parts.day ?? '',
    time: `${parts.hour}:${parts.minute}`,
  }
}

const isSinhala = (locale: string) => locale === 'si'

/** "14:30" */
export function formatTime(input: DateInput): string {
  return enFmt.time.format(new Date(input))
}

/** "13 Oct, 14:30" */
export function formatDateTime(input: DateInput, locale = 'en'): string {
  if (!isSinhala(locale)) return enFmt.dateTime.format(new Date(input))
  const p = siParts(input)
  return `${p.month} ${p.day}, ${p.time}`
}

/** "Tue 14:30" for chart axis labels */
export function formatDayTime(input: DateInput, locale = 'en'): string {
  if (!isSinhala(locale)) return enFmt.dayTime.format(new Date(input))
  const p = siParts(input)
  return `${p.weekday} ${p.time}`
}

/** "13 Oct" for chart axis labels */
export function formatDay(input: DateInput, locale = 'en'): string {
  if (!isSinhala(locale)) return enFmt.date.format(new Date(input))
  const p = siParts(input)
  return `${p.month} ${p.day}`
}
