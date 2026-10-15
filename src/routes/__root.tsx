import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import type { I18n } from '@lingui/core'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { LanguageSwitcher } from '#/components/language-switcher'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
  i18n: I18n
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: ({ match }) => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: match.context.i18n._(
          msg`Agri Web Portal — Soil Sensor Dashboard`,
        ),
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { i18n } = useLingui()
  return (
    <html lang={i18n.locale || 'en'}>
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="paddy-bg" aria-hidden="true" />
        <div className="page-wrap flex flex-wrap items-center justify-between gap-4 pt-4">
          <nav
            aria-label="Main navigation"
            className="flex gap-4 text-sm font-semibold"
          >
            <Link
              to="/"
              activeOptions={{ exact: true }}
              activeProps={{
                className: 'text-lagoon-deep underline underline-offset-4',
              }}
            >
              <Trans>Dashboard</Trans>
            </Link>
            <Link
              to="/ai-predictions"
              activeProps={{
                className: 'text-lagoon-deep underline underline-offset-4',
              }}
            >
              <Trans>AI predictions</Trans>
            </Link>
          </nav>
          <LanguageSwitcher />
        </div>
        {children}
        <p className="px-4 pb-4 text-center text-[10px] text-sea-ink-soft/70">
          <Trans>
            Background photo:{' '}
            <a
              href="https://commons.wikimedia.org/wiki/File:Paddy_fields_sri_lanka.jpg"
              target="_blank"
              rel="noreferrer"
            >
              Paddy fields, Sri Lanka
            </a>{' '}
            by Kasundg,{' '}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY-SA 4.0
            </a>
          </Trans>
        </p>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
