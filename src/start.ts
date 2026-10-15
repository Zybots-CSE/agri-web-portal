import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

import { linguiMiddleware } from '#/lib/i18n/middleware'

// Only server functions (same-origin RPC) are checked — the /api/* ingest
// routes are called by field hardware that sends no Origin header.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, linguiMiddleware],
}))

declare module '@tanstack/react-start' {
  interface Register {
    config: Awaited<ReturnType<typeof startInstance.getOptions>>
  }
}
