import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BrainCircuit, RefreshCw, Radio } from 'lucide-react'
import { Trans, useLingui } from '@lingui/react/macro'
import { getPredictions, updatePredictionStatus } from '#/lib/server/server-fns'
import { formatDateTime } from '#/lib/format'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/ai-predictions')({
  head: () => ({ meta: [{ title: 'AI predictions · AgriCSE | Zybots' }] }),
  component: PredictionsPage,
})

const DUMMY_PREDICTION = {
  model: 'zybots-demo-v1',
  title: 'Demo: soil moisture may fall below target',
  category: 'Demo · Irrigation',
  summary:
    'Hardcoded test prediction for AgriCSE / Zybots. This is sample data, not an actual AI assessment of your farm.',
  confidence: 0.92,
  deviceId: 'PRB-001',
  spot: 'Paddy Block B',
  crop: 'Paddy',
  recommendations: [
    'Demo action: check the latest soil moisture reading at Paddy Block B.',
    'Demo action: review irrigation needs using real field measurements.',
  ],
}

function PredictionsPage() {
  const { t, i18n } = useLingui()
  const [filter, setFilter] = useState('')
  const [showClosed, setShowClosed] = useState(false)
  const queryClient = useQueryClient()
  const dummyRequest = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DUMMY_PREDICTION),
      })
      if (!response.ok)
        throw new Error(`Prediction request failed (${response.status})`)
      return response.json()
    },
    onSuccess: async () => {
      setFilter('')
      setShowClosed(false)
      await queryClient.invalidateQueries({ queryKey: ['predictions'] })
    },
  })
  const statusMutation = useMutation({
    mutationFn: (data: { id: number; closed: boolean }) =>
      updatePredictionStatus({ data }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['predictions'] }),
  })
  const query = useQuery({
    queryKey: ['predictions', { closed: showClosed }],
    queryFn: () => getPredictions({ data: { closed: showClosed } }),
    refetchInterval: 30_000,
  })
  const predictions = query.data ?? []
  const visible = predictions.filter((p) =>
    [p.title, p.category, p.deviceId, p.spot, p.crop, p.model].some((value) =>
      value?.toLowerCase().includes(filter.toLowerCase()),
    ),
  )

  return (
    <main className="page-wrap flex flex-col gap-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="island-kicker">Zybots · AgriCSE</p>
          <h1 className="display-title mt-1 flex items-center gap-3 text-3xl font-bold sm:text-4xl">
            <BrainCircuit className="size-8 text-lagoon-deep" />
            <Trans>Zybot_AI Predictions</Trans>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-sea-ink-soft">
            <Trans>
              Model predictions and recommendations for your farm, connected to
              the probes and sampling spots behind them.
            </Trans>
          </p>
        </div>
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw
            className={query.isFetching ? 'size-4 animate-spin' : 'size-4'}
          />
          <Trans>Refresh</Trans>
        </Button>
      </header>

      <section className="island-shell flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
        <div className="text-sm text-sea-ink-soft">
          <p>
            <Trans>
              Test with a hardcoded sample. Each click saves one clearly labeled
              demo prediction.
            </Trans>
          </p>
          {dummyRequest.isError && (
            <p role="alert" className="mt-2 text-red-700">
              <Trans>
                Could not send the dummy prediction. Check the connection and
                try again.
              </Trans>
            </p>
          )}
          {dummyRequest.isSuccess && (
            <p role="status" className="mt-2 text-lagoon-deep">
              <Trans>Dummy prediction saved successfully.</Trans>
            </p>
          )}
        </div>
        <Button
          onClick={() => dummyRequest.mutate()}
          disabled={dummyRequest.isPending}
        >
          {dummyRequest.isPending ? t`Sending…` : t`Send dummy prediction`}
        </Button>
      </section>

      <section className="island-shell flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
        <div className="flex items-center gap-2 text-sm text-sea-ink-soft">
          <Radio className="size-4 text-lagoon-deep" />
          <Trans>Latest 100 predictions · refreshes every 30 seconds</Trans>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium">
          <Trans>Search predictions</Trans>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t`Probe, crop, spot or model…`}
            className="w-full rounded-lg border border-line bg-(--chip-bg) px-3 py-2 text-sm sm:w-72"
          />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={showClosed ? 'outline' : 'default'}
          aria-pressed={!showClosed}
          onClick={() => setShowClosed(false)}
        >
          <Trans>Open predictions</Trans>
        </Button>
        <Button
          variant={showClosed ? 'default' : 'outline'}
          aria-pressed={showClosed}
          onClick={() => setShowClosed(true)}
        >
          <Trans>Closed predictions</Trans>
        </Button>
      </div>
      {statusMutation.isError && (
        <p role="alert" className="text-sm text-red-700">
          <Trans>Could not update this prediction. Please try again.</Trans>
        </p>
      )}
      {statusMutation.isSuccess && (
        <p role="status" className="text-sm text-lagoon-deep">
          {statusMutation.variables.closed
            ? t`Prediction closed. You can reopen it from Closed predictions.`
            : t`Prediction reopened.`}
        </p>
      )}
      {query.isError && (
        <div
          role="alert"
          className="island-shell rounded-2xl border border-amber-400 p-6"
        >
          <h2 className="font-bold">
            <Trans>Could not load predictions</Trans>
          </h2>
          <p className="mt-2 text-sm">
            <Trans>
              Please try refreshing. If this is your first setup, check the
              database connection and apply the predictions migration.
            </Trans>
          </p>
        </div>
      )}
      {query.isPending ? (
        <p role="status" className="py-12 text-center">
          <Trans>Loading predictions…</Trans>
        </p>
      ) : !query.isError && visible.length === 0 ? (
        <section className="island-shell flex flex-col items-center rounded-2xl px-6 py-16 text-center">
          <BrainCircuit className="mb-4 size-12 text-lagoon-deep" />
          <h2 className="text-xl font-bold">
            {filter
              ? t`No matching predictions`
              : showClosed
                ? t`No closed predictions`
                : t`No open predictions`}
          </h2>
          <p className="mt-3 max-w-lg text-sm text-sea-ink-soft">
            {filter
              ? t`Try a different probe, crop, spot or model.`
              : showClosed
                ? t`Predictions you close will appear here. You can reopen them at any time.`
                : t`New predictions appear here automatically. Send a dummy prediction to test, or connect your AI model.`}
          </p>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {visible.map((p) => (
            <article
              key={p.id}
              className="island-shell min-w-0 rounded-2xl p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-lagoon/15 px-3 py-1 text-xs font-semibold text-lagoon-deep">
                  {p.category}
                </span>
                <span className="text-xs text-sea-ink-soft">
                  {p.confidence === null
                    ? t`Confidence not provided`
                    : t`${Math.round(p.confidence * 100)}% model confidence`}
                </span>
              </div>
              <h2 className="mt-4 break-words text-xl font-bold">{p.title}</h2>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-sea-ink-soft">
                {p.summary}
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-line py-4 text-xs">
                {[
                  [t`Model`, p.model],
                  [t`Predicted`, formatDateTime(p.predictedAt, i18n.locale)],
                  [t`Probe`, p.deviceId],
                  [t`Sampling spot`, p.spot],
                  [t`Crop`, p.crop],
                ].map(([label, value]) =>
                  value ? (
                    <div key={label} className="min-w-0">
                      <dt className="text-sea-ink-soft">{label}</dt>
                      <dd className="mt-1 break-words font-semibold">
                        {value}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
              {p.recommendations.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-bold">
                    <Trans>Model recommendations</Trans>
                  </h3>
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-sea-ink-soft">
                    {p.recommendations.map((item, index) => (
                      <li
                        key={index}
                        className="whitespace-pre-wrap break-words"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-5 flex justify-end">
                <Button
                  variant="outline"
                  disabled={statusMutation.isPending}
                  onClick={() =>
                    statusMutation.mutate({ id: p.id, closed: !p.closed })
                  }
                >
                  {statusMutation.isPending &&
                  statusMutation.variables.id === p.id
                    ? t`Saving…`
                    : p.closed
                      ? t`Reopen prediction`
                      : t`Close prediction`}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <details className="island-shell rounded-2xl p-6">
        <summary className="cursor-pointer text-sm font-bold">
          <Trans>Connect your AI model</Trans>
        </summary>
        <div className="mt-4 space-y-3 text-sm text-sea-ink-soft">
          <p>
            <Trans>Send a JSON result to</Trans>{' '}
            <code>POST /api/predictions</code>.{' '}
            <Trans>
              Confidence is optional and ranges from 0 to 1. Probe and sampling
              spot labels are optional.
            </Trans>
          </p>
          <pre className="overflow-x-auto rounded-xl bg-[#1d2e45] p-4 text-xs leading-relaxed text-[#e8efff]">
            {JSON.stringify(
              {
                model: 'agricse-v1',
                title: 'Your prediction title',
                category: 'Your prediction type',
                summary: 'Explanation from your model',
                confidence: 0.92,
                deviceId: 'PRB-001',
                spot: 'Paddy Block B',
                crop: 'Paddy',
                recommendations: ['Your model’s recommended next step'],
              },
              null,
              2,
            )}
          </pre>
          <p>
            <Trans>Read received results with</Trans>{' '}
            <code>GET /api/predictions?deviceId=PRB-001</code>.
          </p>
        </div>
      </details>
    </main>
  )
}
