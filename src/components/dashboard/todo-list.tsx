import { useEffect, useMemo, useState } from 'react'
import {
  Ban,
  Check,
  CircleCheckBig,
  ClipboardList,
  Droplets,
  FlaskConical,
  Flower2,
  Leaf,
  ScanSearch,
  Shovel,
  Snowflake,
  Sprout,
  Sun,
  Waves,
  Zap,
} from 'lucide-react'

import { Trans, useLingui } from '@lingui/react/macro'

import type { FarmTask, TaskId, TaskSpot } from '#/lib/farm-tasks'
import { buildFarmTasks } from '#/lib/farm-tasks'
import { SENSOR_PARAMS } from '#/lib/sensor-rules'
import { useSensorText } from '#/lib/i18n/sensor-text'
import type { ReadingDTO } from '#/lib/server/queries'
import { cn } from '#/lib/utils'

type Icon = React.ComponentType<{ className?: string }>

const TASK_ICONS: Record<TaskId, Icon> = {
  'ph-low': Shovel,
  'ph-high': FlaskConical,
  'ec-low': Zap,
  'ec-high': Zap,
  'moisture-low': Droplets,
  'moisture-high': Waves,
  'temperature-low': Snowflake,
  'temperature-high': Sun,
  'nitrogen-low': Leaf,
  'nitrogen-high': Ban,
  'phosphorus-low': Sprout,
  'phosphorus-high': Ban,
  'potassium-low': Flower2,
  'potassium-high': Ban,
  recheck: ScanSearch,
}

const STORAGE_KEY = 'agri:done-tasks'

/** Done tasks are remembered per browser; keys change when new readings arrive */
function useDoneTasks() {
  const [done, setDone] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setDone(new Set(JSON.parse(raw) as string[]))
    } catch {
      // ignore corrupt storage
    }
  }, [])

  const toggle = (key: string) => {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // storage full / disabled — keep in-memory state only
      }
      return next
    })
  }

  return { done, toggle }
}

function TaskRow({
  task,
  isDone,
  onToggle,
}: {
  task: FarmTask
  isDone: boolean
  onToggle: () => void
}) {
  const { t, i18n } = useLingui()
  const tx = useSensorText()
  const Icon = TASK_ICONS[task.id]
  const reading = (s: TaskSpot) =>
    s.param
      ? `${tx.short(SENSOR_PARAMS[s.param])} ${s.value}`
      : t`No recent reading`
  return (
    <li
      title={`${i18n._(task.why)}\n${task.spots.map((s) => `${tx.text(s.spot)}: ${reading(s)}`).join('\n')}`}
      className={cn('flex items-center gap-3 py-2', isDone && 'opacity-50')}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={isDone ? t`Mark as not done` : t`Mark as done`}
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-md border',
          isDone
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-line hover:border-emerald-500',
        )}
      >
        {isDone && <Check className="size-3.5" />}
      </button>
      <Icon
        className={cn(
          'size-4 shrink-0',
          isDone
            ? 'text-sea-ink-soft'
            : task.level === 'critical'
              ? 'text-red-600 dark:text-red-400'
              : 'text-amber-600 dark:text-amber-400',
        )}
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          isDone && 'line-through',
        )}
      >
        <span className="font-semibold">{i18n._(task.title)}</span>
        <span className="text-sea-ink-soft">
          {' — '}
          {task.spots.map((s) => tx.text(s.spot)).join(', ')}
        </span>
      </span>
      {!isDone && task.level === 'critical' && (
        <span className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400">
          <Trans>Today</Trans>
        </span>
      )}
    </li>
  )
}

export function TodoList({ readings }: { readings: ReadingDTO[] }) {
  const tasks = useMemo(() => buildFarmTasks(readings), [readings])
  const { done, toggle } = useDoneTasks()

  // Open tasks first (already sorted by urgency), finished ones at the bottom
  const open = tasks.filter((t) => !done.has(t.key))
  const sorted = [...open, ...tasks.filter((t) => done.has(t.key))]
  const openCount = open.length

  return (
    <section
      aria-labelledby="todo-heading"
      className="island-shell rounded-2xl px-5 py-4"
    >
      <h2
        id="todo-heading"
        className="flex items-center gap-2 text-base font-bold"
      >
        <ClipboardList className="size-4 text-lagoon-deep" />
        <Trans>To do</Trans>
        {openCount > 0 && (
          <span className="rounded-full bg-lagoon-deep px-2 text-xs leading-5 text-white">
            {openCount}
          </span>
        )}
      </h2>

      {openCount === 0 ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CircleCheckBig className="size-4" />
          <Trans>Nothing to do right now.</Trans>
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-line">
          {sorted.map((t) => (
            <TaskRow
              key={t.key}
              task={t}
              isDone={done.has(t.key)}
              onToggle={() => toggle(t.key)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
