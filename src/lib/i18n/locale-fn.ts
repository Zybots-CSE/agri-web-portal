import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { serialize } from 'cookie-es'
import { z } from 'zod'

import { LOCALES, LOCALE_COOKIE } from '.'
import type { Locale } from '.'

/** Remembers the chosen language so the next server render uses it */
export const saveLocale = createServerFn({ method: 'POST' })
  .validator(z.enum(Object.keys(LOCALES) as [Locale, ...Locale[]]))
  .handler(({ data }) => {
    setResponseHeader(
      'Set-Cookie',
      serialize(LOCALE_COOKIE, data, {
        maxAge: 365 * 24 * 60 * 60,
        path: '/',
        sameSite: 'lax',
      }),
    )
  })
