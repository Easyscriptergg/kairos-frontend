import { RecoveryEntry, Workout, NutritionEntry } from '../../data/models/types';
import { dayLetter, latestDateKey, shortDate, windowKeys } from '../../data/domain/dates';

// ============================================================
// HOME — OVERVIEW METRICS
// Pure derivations from store data for the overview cards.
// Windows are calendar days ending on the most recent day that
// has any logged data; days without an entry stay null so the
// charts can show the gap instead of inventing a value.
// ============================================================

const SLEEP_TARGET_HOURS = 7.5;
const FUEL_TARGET_RATIO = 0.9;
const MAX_WAVEFORM_BARS = 140;

function mean(values: number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

function present<T>(values: (T | null | undefined)[]): T[] {
  return values.filter((v): v is T => v !== null && v !== undefined);
}

export function splitHours(hours: number): { h: number; m: number } {
  const totalMinutes = Math.round(hours * 60);
  return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 };
}

export function formatSigned(value: number, unit = ''): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  return `${sign}${Math.abs(value)}${unit}`;
}

export interface MatrixCell {
  /** 0–1 share of the row's reference value, null when nothing was logged */
  level: number | null;
  met: boolean;
}

export function buildOverview(recovery: RecoveryEntry[], workouts: Workout[], nutrition: NutritionEntry[]) {
  const anchor = latestDateKey(recovery, workouts, nutrition);
  if (anchor === null) return null;

  const week = windowKeys(anchor, 7);
  const prevWeek = windowKeys(anchor, 7, 7);
  const month = windowKeys(anchor, 30);

  const recoveryByDate = new Map(recovery.map(r => [r.date, r]));
  const nutritionByDate = new Map(nutrition.map(n => [n.date, n]));
  const workoutsOn = (keys: string[]) => workouts.filter(w => keys.includes(w.date));

  const weekRecovery = week.map(k => recoveryByDate.get(k) ?? null);
  const prevRecovery = prevWeek.map(k => recoveryByDate.get(k) ?? null);
  const weekWorkouts = workoutsOn(week);
  const prevWorkouts = workoutsOn(prevWeek);
  const monthWorkouts = workoutsOn(month).sort((a, b) => a.date.localeCompare(b.date));

  // --- Activity: training / fuel / sleep adherence per day ---
  const minutesByDay = week.map(k => weekWorkouts.filter(w => w.date === k).reduce((s, w) => s + w.duration, 0));
  const maxMinutes = Math.max(1, ...minutesByDay);
  const trainingMinutes = minutesByDay.reduce((s, m) => s + m, 0);

  const activityRows: { label: string; hint: string; cells: MatrixCell[] }[] = [
    {
      label: 'Train',
      hint: 'Session logged, sized by duration',
      cells: minutesByDay.map(m => ({ level: m > 0 ? m / maxMinutes : null, met: m > 0 })),
    },
    {
      label: 'Fuel',
      hint: `Energy intake vs target, bright at ${Math.round(FUEL_TARGET_RATIO * 100)}%+`,
      cells: week.map(k => {
        const n = nutritionByDate.get(k);
        if (!n || !n.targets.calories) return { level: null, met: false };
        const ratio = n.calories / n.targets.calories;
        return { level: Math.min(1, ratio), met: ratio >= FUEL_TARGET_RATIO };
      }),
    },
    {
      label: 'Sleep',
      hint: `Sleep duration, bright at ${SLEEP_TARGET_HOURS}h+`,
      cells: weekRecovery.map(r => (
        r ? { level: Math.min(1, r.sleepDuration / 9), met: r.sleepDuration >= SLEEP_TARGET_HOURS } : { level: null, met: false }
      )),
    },
  ];

  // --- Sleep: this week vs the previous one ---
  const sleepAvg = mean(present(weekRecovery).map(r => r.sleepDuration));
  const sleepPrevAvg = mean(present(prevRecovery).map(r => r.sleepDuration));
  const sleepSeries = week.map((k, i) => ({
    label: dayLetter(k),
    date: shortDate(k),
    current: weekRecovery[i]?.sleepDuration ?? null,
    previous: prevRecovery[i]?.sleepDuration ?? null,
  }));

  // --- Heart: HRV against the 30-day baseline ---
  const monthRecovery = present(month.map(k => recoveryByDate.get(k) ?? null));
  const hrvBaseline = mean(present(monthRecovery.map(r => r.hrv)));
  const latestRecovery = present(weekRecovery).slice(-1)[0] ?? null;
  const hrvBars = week.map((k, i) => ({
    label: dayLetter(k),
    date: shortDate(k),
    value: weekRecovery[i]?.hrv ?? null,
    highlighted: weekRecovery[i] !== null && weekRecovery[i] === latestRecovery,
  }));

  // --- Recovery trend over 30 days, against resting HR and rolling 7-day training load ---
  const recoveryTrend = month.map(k => {
    const r = recoveryByDate.get(k);
    const trailingWeek = windowKeys(k, 7);
    return {
      date: shortDate(k),
      recovery: r?.recoveryScore ?? null,
      restingHR: r?.restingHR ?? null,
      load: workouts.filter(w => trailingWeek.includes(w.date)).reduce((s, w) => s + w.trainingLoad, 0),
    };
  });
  const recoveryWeekAvg = mean(present(weekRecovery).map(r => r.recoveryScore));

  // --- Training load: one bar per exercise, grouped by session ---
  const latestSessionId = monthWorkouts.length ? monthWorkouts[monthWorkouts.length - 1].id : null;
  const waveform = monthWorkouts
    .flatMap(w => w.exercises.map(we => ({
      id: we.id,
      label: `${we.exercise.name} · ${shortDate(w.date)}`,
      volume: we.sets.reduce((s, set) => s + set.weight * set.reps, 0),
      latest: w.id === latestSessionId,
    })))
    .slice(-MAX_WAVEFORM_BARS);

  const load7 = weekWorkouts.reduce((s, w) => s + w.trainingLoad, 0);
  const loadPrev7 = prevWorkouts.reduce((s, w) => s + w.trainingLoad, 0);

  return {
    range: { start: week[0], end: anchor },
    days: week.map(dayLetter),
    activity: {
      rows: activityRows,
      trainingMinutes,
      sessions: weekWorkouts.length,
    },
    sleep: {
      series: sleepSeries,
      avgHours: sleepAvg,
      deltaMinutes: sleepAvg !== null && sleepPrevAvg !== null ? Math.round((sleepAvg - sleepPrevAvg) * 60) : null,
      nights: present(weekRecovery).length,
    },
    heart: {
      bars: hrvBars,
      baseline: hrvBaseline !== null ? Math.round(hrvBaseline) : null,
      restingHR: latestRecovery?.restingHR ?? null,
      hrv: latestRecovery?.hrv ?? null,
    },
    recovery: {
      trend: recoveryTrend,
      score: latestRecovery?.recoveryScore ?? null,
      deltaVsWeek: latestRecovery && recoveryWeekAvg !== null ? Math.round(latestRecovery.recoveryScore - recoveryWeekAvg) : null,
      sleepAvg,
      hrv: latestRecovery?.hrv ?? null,
    },
    load: {
      waveform,
      load7,
      deltaPct: loadPrev7 > 0 ? Math.round(((load7 - loadPrev7) / loadPrev7) * 100) : null,
      avgSessionMinutes: monthWorkouts.length ? Math.round(monthWorkouts.reduce((s, w) => s + w.duration, 0) / monthWorkouts.length) : null,
      sessions30: monthWorkouts.length,
    },
  };
}

export type OverviewMetrics = NonNullable<ReturnType<typeof buildOverview>>;
