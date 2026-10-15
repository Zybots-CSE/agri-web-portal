import { useState } from 'react'
import { useLingui } from '@lingui/react'
import { useLingui as useLinguiMacro } from '@lingui/react/macro'
import { useRouter } from '@tanstack/react-router'
import { Languages } from 'lucide-react'

import { LOCALES, activateLocale } from '#/lib/i18n'
import type { Locale } from '#/lib/i18n'
import { saveLocale } from '#/lib/i18n/locale-fn'
import { cn } from '#/lib/utils'

export function LanguageSwitcher() {
  const { i18n } = useLingui()
  const { t } = useLinguiMacro()
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const change = async (locale: Locale) => {
    if (locale === i18n.locale || pending) return
    setPending(true)
    try {
      await Promise.all([
        saveLocale({ data: locale }),
        activateLocale(i18n, locale),
      ])
      // Re-run head() so the document title follows the new language
      await router.invalidate()
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      role="group"
      aria-label={t`Language`}
      className="flex items-center gap-0.5 rounded-lg border border-line bg-(--chip-bg) p-0.5"
    >
      <Languages className="mx-1.5 size-3.5 text-sea-ink-soft" aria-hidden />
      {(Object.keys(LOCALES) as Locale[]).map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          onClick={() => void change(locale)}
          disabled={pending}
          aria-pressed={locale === i18n.locale}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-wait',
            locale === i18n.locale
              ? 'bg-sea-ink text-white'
              : 'text-sea-ink-soft hover:bg-accent hover:text-sea-ink',
          )}
        >
          {LOCALES[locale]}
        </button>
      ))}
    </div>
  )
}
