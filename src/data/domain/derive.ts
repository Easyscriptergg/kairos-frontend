import {
  AppSettings, AthleteProfile, AthleteRecords, AthleteState, DomainScore, Insight, KairosRecommendation,
  PerformanceEntry, PR, QualityLevel, RecommendationSensitivity, TimelineEvent, TrendDirection, Workout,
} from '../models/types';
import { daysBetween, latestDateKey, shortDate, todayKey, windowKeys } from './dates';
import { estimateOneRepMax, isHardSet, mean } from './scoring';

// ============================================================
// DERIVED STATE
// Everything the app shows beyond the raw records is calculated
// here, from the same records every page reads. Nothing in this
// file is random and nothing is invented: a value that cannot be
// calculated from logged records is null (or the item is omitted).
// ============================================================

/** Recovery score at or above which the athlete is called ready for a full session. */
export const READY_THRESHOLDS: Record<RecommendationSensitivity, number> = {
  conservative: 85,
  balanced: 80,
  aggressive: 75,
};

/** Weekly session target assumed until the athlete sets one in their profile. */
export const DEFAULT_WEEKLY_SESSIONS = 3;

export const OVERALL_WEIGHTS = { recovery: 0.3, training: 0.2, nutrition: 0.2, performance: 0.3 } as const;

const SLEEP_GROUP_HOURS = 7.5;
const MIN_GROUP_SIZE = 3;

export interface DerivedState {
  athleteState: AthleteState | null;
  performance: PerformanceEntry[];
  insights: Insight[];
  recommendation: KairosRecommendation | null;
  timeline: TimelineEvent[];
}

export function deriveAll(records: AthleteRecords, settings: AppSettings): DerivedState {
  const performance = derivePerformance(records.workouts, records.profile);
  const athleteState = computeAthleteState(records, performance, settings);
  return {
    athleteState,
    performance,
    insights: athleteState ? deriveInsights(records, performance, athleteState.asOf) : [],
    recommendation: athleteState ? generateRecommendation(athleteState, records, settings) : null,
    timeline: buildTimeline(records),
  };
}

// --- Performance: weekly strength snapshots from logged sets ---
export function derivePerformance(workouts: Workout[], profile: AthleteProfile | null): PerformanceEntry[] {
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return [];

  const firstDate = sorted[0].date;
  const weeks = new Map<number, Workout[]>();
  for (const w of sorted) {
    const index = Math.floor(daysBetween(firstDate, w.date) / 7);
    weeks.set(index, [...(weeks.get(index) ?? []), w]);
  }

  const allTimeBest: Record<string, number> = {};
  const entries: PerformanceEntry[] = [];
  let previous: Record<string, number> | null = null;

  for (const [index, weekWorkouts] of [...weeks.entries()].sort((a, b) => a[0] - b[0])) {
    const best: Record<string, { value: number; date: string; name: string }> = {};
    for (const w of weekWorkouts) {
      for (const we of w.exercises) {
        for (const set of we.sets) {
          if (!isHardSet(set)) continue;
          const e1rm = estimateOneRepMax(set.weight, set.reps);
          if (e1rm !== null && (!best[we.exerciseId] || e1rm > best[we.exerciseId].value)) {
            best[we.exerciseId] = { value: e1rm, date: w.date, name: we.exercise.name };
          }
        }
      }
    }
    const ids = Object.keys(best);
    if (ids.length === 0) continue;

    const prs: PR[] = [];
    for (const id of ids) {
      const prior = allTimeBest[id];
      if (prior !== undefined && best[id].value > prior) {
        prs.push({ exerciseId: id, exerciseName: best[id].name, value: best[id].value, unit: 'kg', date: best[id].date, previous: prior });
      }
      allTimeBest[id] = Math.max(prior ?? 0, best[id].value);
    }

    const estimated1RMs = Object.fromEntries(ids.map(id => [id, best[id].value]));
    const ratios = previous ? ids.filter(id => previous![id]).map(id => best[id].value / previous![id]) : [];
    const change = mean(ratios);
    const strengthTrend: TrendDirection = change === null ? 'stable' : change > 1.01 ? 'improving' : change < 0.99 ? 'declining' : 'stable';

    const bench = estimated1RMs['bench-press'];
    const bodyWeight = profile?.bodyMetrics?.weight;
    entries.push({
      id: `perf-week-${index}`,
      date: weekWorkouts[weekWorkouts.length - 1].date,
      sport: 'strength',
      metrics: {
        type: 'strength',
        estimated1RMs,
        totalVolume: weekWorkouts.reduce((s, w) => s + w.trainingLoad, 0),
        relativeStrength: bench && bodyWeight ? Math.round((bench / bodyWeight) * 100) / 100 : undefined,
        prs,
        strengthTrend,
      },
    });
    previous = estimated1RMs;
  }

  return entries;
}

// --- Athlete state ---
function trendOf(current: number | null, prior: number | null, tolerance: number): TrendDirection {
  if (current === null || prior === null) return 'stable';
  if (current - prior > tolerance) return 'improving';
  if (prior - current > tolerance) return 'declining';
  return 'stable';
}

export function computeAthleteState(records: AthleteRecords, performance: PerformanceEntry[], settings: AppSettings): AthleteState | null {
  const { recovery, workouts, nutrition, profile } = records;
  const asOf = latestDateKey(recovery, workouts, nutrition);
  if (asOf === null) return null;

  const week = windowKeys(asOf, 7);
  const priorWeek = windowKeys(asOf, 7, 7);
  const inWindow = <T extends { date: string }>(items: T[], keys: string[]) =>
    items.filter(i => keys.includes(i.date)).sort((a, b) => a.date.localeCompare(b.date));

  // Recovery: mean of the three most recent check-ins this week
  const weekRecovery = inWindow(recovery, week);
  const recoveryAvg = mean(weekRecovery.slice(-3).map(r => r.recoveryScore));
  const recoveryTrend = trendOf(
    mean(weekRecovery.map(r => r.recoveryScore)),
    mean(inWindow(recovery, priorWeek).map(r => r.recoveryScore)),
    2,
  );

  // Training: sessions logged this week against the weekly target
  const weekWorkouts = inWindow(workouts, week);
  const priorWorkouts = inWindow(workouts, priorWeek);
  const sessionTarget = profile?.trainingFrequency || DEFAULT_WEEKLY_SESSIONS;
  const trainingScore = workouts.length === 0 ? null : Math.min(100, Math.round((weekWorkouts.length / sessionTarget) * 100));

  // Nutrition: energy and protein against target, averaged over logged days this week.
  // Today is left out because it is still in progress and would read as under-eating.
  const today = todayKey();
  const adherence = (items: typeof nutrition) => mean(items.filter(n => n.date !== today).map(n =>
    Math.min(1, n.calories / n.targets.calories) * 50 + Math.min(1, n.protein / n.targets.protein) * 50,
  ));
  const nutritionAvg = adherence(inWindow(nutrition, week));

  // Performance: direction of estimated 1RMs in the latest week that had hard sets
  const latestPerf = performance[performance.length - 1];
  const performanceTrend: TrendDirection = latestPerf?.metrics.type === 'strength' ? latestPerf.metrics.strengthTrend : 'stable';
  const performanceScore = latestPerf ? { improving: 85, stable: 80, declining: 70 }[performanceTrend] : null;

  const round = (n: number | null) => (n === null ? null : Math.round(n));
  const scores = {
    recovery: round(recoveryAvg),
    training: trainingScore,
    nutrition: round(nutritionAvg),
    performance: performanceScore,
  };

  // Overall: weighted mean of the domains that have data; needs at least two
  const available = (Object.keys(scores) as (keyof typeof scores)[]).filter(k => scores[k] !== null);
  const weightTotal = available.reduce((s, k) => s + OVERALL_WEIGHTS[k], 0);
  const overall = available.length >= 2
    ? Math.round(available.reduce((s, k) => s + scores[k]! * OVERALL_WEIGHTS[k], 0) / weightTotal)
    : null;

  const nutritionStatus: QualityLevel | null = scores.nutrition === null ? null
    : scores.nutrition > 80 ? 'excellent' : scores.nutrition > 65 ? 'good' : scores.nutrition > 50 ? 'fair' : 'poor';

  const domain = (score: number | null, trend: TrendDirection, label: string): DomainScore => ({ score, trend, label });

  return {
    overallScore: overall,
    // Readiness is about recovery alone: a low training or nutrition score is not fatigue
    readiness: scores.recovery === null ? null : scores.recovery >= READY_THRESHOLDS[settings.sensitivity] ? 'ready' : scores.recovery >= 65 ? 'moderate' : 'fatigued',
    domains: {
      training: domain(scores.training, trendOf(weekWorkouts.length, workouts.length ? priorWorkouts.length : null, 0), 'Training'),
      recovery: domain(scores.recovery, recoveryTrend, 'Recovery'),
      nutrition: domain(scores.nutrition, trendOf(nutritionAvg, adherence(inWindow(nutrition, priorWeek)), 3), 'Nutrition'),
      performance: domain(scores.performance, performanceTrend, 'Performance'),
    },
    trainingLoad: weekWorkouts.reduce((s, w) => s + w.trainingLoad, 0),
    fatigue: weekRecovery.length ? weekRecovery[weekRecovery.length - 1].fatigue : null,
    sleepTrend: recoveryTrend,
    nutritionStatus,
    performanceTrend,
    asOf,
  };
}

// --- Today's recommendation ---
export function generateRecommendation(state: AthleteState, records: AthleteRecords, settings: AppSettings): KairosRecommendation | null {
  const latest = [...records.recovery].sort((a, b) => a.date.localeCompare(b.date)).filter(r => daysBetween(r.date, state.asOf) < 7).pop();
  const base = { id: `rec-${state.asOf}`, title: "Today's Kairos", createdAt: state.asOf };
  const disclaimer = 'Scores are internal Kairos calculations from your logged records, not medical measures.';

  if (!latest) {
    return {
      ...base,
      message: 'No recovery check-in has been logged in the last 7 days, so Kairos cannot judge how ready you are. Log this morning’s sleep and heart-rate numbers to get a recommendation.',
      reasoning: `Recommendations compare your recovery score with recent training load. ${disclaimer}`,
      action: '/recover',
      actionLabel: 'Log check-in',
      priority: 'medium',
      domains: ['recovery'],
    };
  }

  const facts = `Latest recovery score is ${latest.recoveryScore}/100 from ${latest.sleepDuration.toFixed(1)}h of sleep`
    + `${latest.hrv !== undefined ? `, HRV ${latest.hrv} ms` : ''} and a resting heart rate of ${latest.restingHR} bpm.`;
  const threshold = READY_THRESHOLDS[settings.sensitivity];
  const reasoning = `${state.domains.recovery.score !== null ? `Your recovery score has averaged ${state.domains.recovery.score}/100 over your latest check-ins; the “ready” threshold is ${threshold} on the ${settings.sensitivity} profile. ` : ''}`
    + `7-day training load is ${state.trainingLoad}. ${disclaimer}`;

  if (state.fatigue === 'high' || state.fatigue === 'very-high' || state.readiness === 'fatigued') {
    return {
      ...base,
      message: `${facts} That points to accumulated fatigue — keep today light or make it a recovery day.`,
      reasoning,
      action: '/recover',
      actionLabel: 'Recovery focus',
      priority: 'high',
      domains: ['recovery', 'training'],
    };
  }

  if (state.readiness === 'ready') {
    return {
      ...base,
      message: `${facts} You are in a good position for a full training session today.`,
      reasoning,
      action: '/train',
      actionLabel: 'Start session',
      priority: 'high',
      domains: ['training', 'recovery'],
    };
  }

  return {
    ...base,
    message: `${facts} A normal session is reasonable — judge the warm-up sets and adjust intensity if they feel heavy.`,
    reasoning,
    action: '/train',
    actionLabel: 'Start session',
    priority: 'medium',
    domains: ['training'],
  };
}

// --- Timeline: one event per record, newest first ---
const TIMELINE_ORDER: Partial<Record<TimelineEvent['type'], number>> = { training: 0, nutrition: 1, recovery: 2 };

export function buildTimeline(records: AthleteRecords): TimelineEvent[] {
  const events: TimelineEvent[] = [
    ...records.workouts.map(w => ({
      id: `tl-${w.id}`,
      date: w.date,
      time: '',
      type: 'training' as const,
      title: w.name,
      description: `${w.intensity ? `${w.intensity.replace('-', ' ')} intensity · ` : ''}${w.duration} min · ${w.exercises.length} exercises`,
      value: `Load ${w.trainingLoad}`,
    })),
    ...records.nutrition.map(n => ({
      id: `tl-${n.id}`,
      date: n.date,
      time: '',
      type: 'nutrition' as const,
      title: 'Nutrition logged',
      description: `${n.calories.toLocaleString('en-US')} kcal · ${n.protein} g protein · ${n.meals.length} ${n.meals.length === 1 ? 'meal' : 'meals'}`,
      value: `${Math.round((n.calories / n.targets.calories) * 100)}% of energy target`,
    })),
    ...records.recovery.map(r => ({
      id: `tl-${r.id}`,
      date: r.date,
      time: r.source.provider === 'manual' ? new Date(r.source.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
      type: 'recovery' as const,
      title: 'Recovery check-in',
      description: `${r.sleepDuration.toFixed(1)}h sleep${r.hrv !== undefined ? ` · HRV ${r.hrv} ms` : ''} · resting HR ${r.restingHR} bpm`,
      value: `Score ${r.recoveryScore}`,
    })),
  ];

  return events.sort((a, b) => b.date.localeCompare(a.date) || (TIMELINE_ORDER[a.type] ?? 9) - (TIMELINE_ORDER[b.type] ?? 9));
}

// --- Insights: simple comparisons within the athlete's own records ---
const pctDiff = (a: number, b: number) => Math.round(((a - b) / b) * 100);

export function deriveInsights(records: AthleteRecords, performance: PerformanceEntry[], asOf: string): Insight[] {
  const { recovery, workouts, nutrition } = records;
  const insights: Insight[] = [];
  const recoveryByDate = new Map(recovery.map(r => [r.date, r]));
  const nutritionByDate = new Map(nutrition.map(n => [n.date, n]));
  // Easy sessions are left out of load comparisons so a planned deload does not read as a bad day
  const hardSessions = workouts.filter(w => w.intensity !== 'low');
  const make = (insight: Omit<Insight, 'createdAt' | 'type'> & { type?: Insight['type'] }): Insight => ({ type: 'pattern', createdAt: asOf, ...insight });

  // 1. Sleep before a session vs the load achieved
  const rested = hardSessions.filter(w => (recoveryByDate.get(w.date)?.sleepDuration ?? -1) >= SLEEP_GROUP_HOURS);
  const short = hardSessions.filter(w => {
    const sleep = recoveryByDate.get(w.date)?.sleepDuration;
    return sleep !== undefined && sleep < SLEEP_GROUP_HOURS;
  });
  if (rested.length >= MIN_GROUP_SIZE && short.length >= MIN_GROUP_SIZE) {
    const restedLoad = mean(rested.map(w => w.trainingLoad))!;
    const shortLoad = mean(short.map(w => w.trainingLoad))!;
    const diff = pctDiff(restedLoad, shortLoad);
    if (Math.abs(diff) >= 5) {
      insights.push(make({
        id: 'insight-sleep-load',
        category: 'sleep-performance',
        title: diff > 0 ? 'Sessions after longer sleep carried more load' : 'Sessions after shorter sleep carried more load',
        observation: `Sessions after ${SLEEP_GROUP_HOURS}h+ of sleep averaged a training load of ${Math.round(restedLoad)}, against ${Math.round(shortLoad)} after shorter nights (${diff > 0 ? '+' : ''}${diff}%).`,
        evidence: `${rested.length} sessions followed ${SLEEP_GROUP_HOURS}h+ of sleep and ${short.length} followed less. Easy (low-intensity) sessions are excluded.`,
        interpretation: 'This is an association in your own log, not proof that sleep caused the difference — the programme itself changes from week to week.',
        recommendation: diff > 0 ? `Where you can, place your hardest sessions after nights of ${SLEEP_GROUP_HOURS}h or more.` : 'Sleep length does not appear to be limiting your sessions at the moment.',
        domains: ['recovery', 'training'],
      }));
    }
  }

  // 2. The heaviest training week vs recovery that week
  const weekly = [0, 1, 2, 3].map(k => {
    const keys = windowKeys(asOf, 7, k * 7);
    return {
      start: keys[0],
      load: workouts.filter(w => keys.includes(w.date)).reduce((s, w) => s + w.trainingLoad, 0),
      recovery: mean(recovery.filter(r => keys.includes(r.date)).map(r => r.recoveryScore)),
    };
  }).filter(w => w.load > 0);
  if (weekly.length >= 3) {
    const peak = weekly.reduce((a, b) => (b.load > a.load ? b : a));
    const otherLoad = mean(weekly.filter(w => w !== peak).map(w => w.load))!;
    const otherRecovery = mean(weekly.filter(w => w !== peak && w.recovery !== null).map(w => w.recovery!));
    if (peak.recovery !== null && otherRecovery !== null && peak.load >= otherLoad * 1.1 && otherRecovery - peak.recovery >= 3) {
      insights.push(make({
        id: 'insight-load-recovery',
        category: 'load-fatigue',
        title: 'Your heaviest week coincided with lower recovery',
        observation: `In the week from ${shortDate(peak.start)} training load reached ${peak.load}, ${pctDiff(peak.load, otherLoad)}% above your other recent weeks, while recovery averaged ${Math.round(peak.recovery)} against ${Math.round(otherRecovery)}.`,
        evidence: `Compared across the last ${weekly.length} weeks that contain logged sessions.`,
        interpretation: 'Recovery scores dipping in a high-load week is expected; it matters when the dip persists into the following week.',
        recommendation: 'Keep week-to-week load increases modest when recovery scores are already below your usual range.',
        domains: ['training', 'recovery'],
      }));
    }
  }

  // 3. HRV this week vs the 30-day average
  const hrvIn = (keys: string[]) => mean(recovery.filter(r => keys.includes(r.date) && r.hrv !== undefined).map(r => r.hrv!));
  const hrvWeek = hrvIn(windowKeys(asOf, 7));
  const hrvMonth = hrvIn(windowKeys(asOf, 30));
  const hrvReadings = recovery.filter(r => r.hrv !== undefined && daysBetween(r.date, asOf) < 30).length;
  if (hrvWeek !== null && hrvMonth !== null && hrvReadings >= 10 && Math.abs(pctDiff(hrvWeek, hrvMonth)) >= 5) {
    const diff = pctDiff(hrvWeek, hrvMonth);
    insights.push(make({
      id: 'insight-hrv-baseline',
      type: diff > 0 ? 'improvement' : 'warning',
      category: 'recovery-training',
      title: diff > 0 ? 'HRV is running above your 30-day average' : 'HRV is running below your 30-day average',
      observation: `HRV averaged ${Math.round(hrvWeek)} ms over the last 7 days against ${Math.round(hrvMonth)} ms over the last 30 (${diff > 0 ? '+' : ''}${diff}%).`,
      evidence: `Based on ${hrvReadings} HRV readings in the last 30 days.`,
      interpretation: diff > 0 ? 'A week above your own baseline usually accompanies lower accumulated fatigue.' : 'A week below your own baseline often accompanies accumulated fatigue, poor sleep or stress.',
      recommendation: diff > 0 ? 'This is a reasonable window to resume harder training.' : 'Consider easing intensity until HRV returns toward your average.',
      domains: ['recovery', 'training'],
    }));
  }

  // 4. Largest estimated-1RM change across the log
  const gains = new Map<string, { first: number; latest: number }>();
  for (const entry of performance) {
    if (entry.metrics.type !== 'strength') continue;
    for (const [id, value] of Object.entries(entry.metrics.estimated1RMs)) {
      gains.set(id, { first: gains.get(id)?.first ?? value, latest: value });
    }
  }
  const top = [...gains.entries()]
    .map(([id, g]) => ({ id, ...g, pct: pctDiff(g.latest, g.first) }))
    .filter(g => g.latest !== g.first)
    .sort((a, b) => b.pct - a.pct)[0];
  if (top && top.pct >= 2) {
    const name = workouts.flatMap(w => w.exercises).find(we => we.exerciseId === top.id)?.exercise.name ?? top.id;
    insights.push(make({
      id: 'insight-strength-gain',
      type: 'improvement',
      category: 'volume-progress',
      title: `${name} is your fastest-improving lift`,
      observation: `Estimated 1RM for ${name} moved from ${top.first} kg to ${top.latest} kg (+${top.pct}%).`,
      evidence: 'Estimated with the Epley formula from sets of 1–12 reps logged at RPE 7 or higher, compared between the first and latest week containing such sets.',
      interpretation: 'An estimate from submaximal sets is less exact than a tested maximum, but the direction is reliable when the same lift is trained consistently.',
      recommendation: 'Keep the current progression on this lift while recovery scores hold.',
      domains: ['training', 'performance'],
    }));
  }

  // 5. Carbohydrate intake on the day vs the load achieved
  const withCarbs = hardSessions.flatMap(w => {
    const day = nutritionByDate.get(w.date);
    return day ? [{ load: w.trainingLoad, met: day.carbohydrates >= day.targets.carbohydrates }] : [];
  });
  const fuelled = withCarbs.filter(s => s.met);
  const underFuelled = withCarbs.filter(s => !s.met);
  if (fuelled.length >= MIN_GROUP_SIZE && underFuelled.length >= MIN_GROUP_SIZE) {
    const fuelledLoad = mean(fuelled.map(s => s.load))!;
    const underLoad = mean(underFuelled.map(s => s.load))!;
    const diff = pctDiff(fuelledLoad, underLoad);
    if (diff >= 5) {
      insights.push(make({
        id: 'insight-carbs-load',
        category: 'nutrition-performance',
        title: 'Sessions on higher-carbohydrate days carried more load',
        observation: `On days you met your carbohydrate target, sessions averaged a load of ${Math.round(fuelledLoad)}, against ${Math.round(underLoad)} on days you did not (+${diff}%).`,
        evidence: `${fuelled.length} sessions on days at or above target and ${underFuelled.length} on days below it. Easy sessions are excluded.`,
        interpretation: 'An association in your own log; heavier training days may also simply be the days you eat more.',
        recommendation: 'Aim to reach your carbohydrate target on days with a hard session planned.',
        domains: ['nutrition', 'training'],
      }));
    }
  }

  return insights;
}
