import type { I18n } from '@lingui/core'

/** UI languages, labelled in their own script for the language switcher */
export const LOCALES = {
  en: 'English',
  si: 'සිංහල',
  ta: 'தமிழ்',
} as const

export type Locale = keyof typeof LOCALES

export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_COOKIE = 'locale'

export function isLocale(value: string): value is Locale {
  return Object.hasOwn(LOCALES, value)
}

/** Loads only the catalog for the requested locale, then activates it */
export async function activateLocale(i18n: I18n, locale: Locale) {
  const { messages } = await import(`../../locales/${locale}/messages.po`)
  i18n.loadAndActivate({ locale, messages })
}
