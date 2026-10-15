import { setupI18n } from '@lingui/core'
import { createMiddleware } from '@tanstack/react-start'
import { parse } from 'cookie-es'

import { DEFAULT_LOCALE, LOCALE_COOKIE, activateLocale, isLocale } from '.'
import type { Locale } from '.'

/**
 * Picks the language for this request: saved cookie first, then the
 * browser's Accept-Language header, then English.
 */
function localeFromRequest(request: Request): Locale {
  const cookie = parse(request.headers.get('cookie') ?? '')[LOCALE_COOKIE]
  if (cookie && isLocale(cookie)) return cookie

  const accepted = (request.headers.get('accept-language') ?? '')
    .split(',')
    .map((part) => part.split(';')[0]!.trim().toLowerCase().split('-')[0]!)
  return accepted.find(isLocale) ?? DEFAULT_LOCALE
}

/** Creates a per-request i18n instance and exposes it on the Start context */
export const linguiMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const locale = localeFromRequest(request)
    const i18n = setupI18n()
    await activateLocale(i18n, locale)
    return next({ context: { i18n } })
  },
)
