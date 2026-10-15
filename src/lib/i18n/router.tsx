import type { PropsWithChildren } from 'react'
import { I18nProvider } from '@lingui/react'
import type { I18n, Messages } from '@lingui/core'
import type { AnyRouter } from '@tanstack/react-router'

type DehydratedI18n = { locale: string; messages: Messages }

/**
 * Wires Lingui into the router: wraps the app in <I18nProvider>, and ships
 * the server's active locale + catalog to the client so hydration renders
 * the exact same text.
 */
export function setupRouterLingui(router: AnyRouter, i18n: I18n) {
  const og = router.options
  const OGWrap = og.Wrap

  // Not `og.Wrap ?? Fragment`: the devtools source injector would add a
  // `data-tsd-source` prop to <OGWrap>, which React rejects on a Fragment.
  router.options.Wrap = ({ children }: PropsWithChildren) => (
    <I18nProvider i18n={i18n}>
      {OGWrap ? <OGWrap>{children}</OGWrap> : children}
    </I18nProvider>
  )

  if (router.isServer) {
    const ogDehydrate = og.dehydrate
    router.options.dehydrate = async () => ({
      ...(await ogDehydrate?.()),
      i18n: { locale: i18n.locale, messages: i18n.messages },
    })
  } else {
    const ogHydrate = og.hydrate
    router.options.hydrate = async (dehydrated) => {
      await ogHydrate?.(dehydrated)
      const data = (dehydrated as { i18n?: DehydratedI18n }).i18n
      if (data) i18n.loadAndActivate(data)
    }
  }
}
