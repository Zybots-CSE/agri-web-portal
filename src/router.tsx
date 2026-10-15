import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { getGlobalStartContext } from '@tanstack/react-start'
import { setupI18n } from '@lingui/core'
import { routeTree } from './routeTree.gen'

import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { getContext } from './integrations/tanstack-query/root-provider'
import { setupRouterLingui } from './lib/i18n/router'

export function getRouter() {
  const context = getContext()
  // Server: per-request instance from the Lingui middleware.
  // Client: empty instance, filled from the dehydrated server state.
  const i18n = getGlobalStartContext()?.i18n ?? setupI18n()

  const router = createTanStackRouter({
    routeTree,
    context: { ...context, i18n },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  setupRouterLingui(router, i18n)
  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
