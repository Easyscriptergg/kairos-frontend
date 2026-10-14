import { FatigueLevel, IntensityLevel, WorkoutExercise, WorkoutSet } from '../models/types';

// ============================================================
// SCORING
// The only place Kairos turns raw records into scores. These are
// internal, deterministic calculations — not validated medical or
// sports-science measures — and the UI says so wherever they appear.
// ============================================================

const clampPct = (n: number) => Math.min(100, Math.max(0, n));

export const mean = (values: number[]): number | null =>
  values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;

/**
 * Recovery score, 0–100: 35% sleep duration (9h = 100), 40% HRV (75 ms = 100),
 * 25% resting heart rate (50 bpm = 100, 70 bpm = 0). Without an HRV reading the
 * sleep and heart-rate parts are re-weighted to fill the scale.
 */
export function computeRecoveryScore(input: { sleepDuration: number; restingHR: number; hrv?: number }): number {
  const sleep = clampPct((input.sleepDuration / 9) * 100);
  const rhr = clampPct(((70 - input.restingHR) / 20) * 100);
  if (input.hrv === undefined) return Math.round((sleep * 0.35 + rhr * 0.25) / 0.6);
  const hrv = clampPct((input.hrv / 75) * 100);
  return Math.round(sleep * 0.35 + hrv * 0.4 + rhr * 0.25);
}

export function fatigueFromRecovery(score: number): FatigueLevel {
  if (score < 55) return 'very-high';
  if (score < 65) return 'high';
  if (score < 78) return 'moderate';
  return 'low';
}

export const RECOVERY_BANDS = { high: 80, moderate: 65 } as const;

export function recoveryBand(score: number): 'high' | 'moderate' | 'low' {
  if (score >= RECOVERY_BANDS.high) return 'high';
  if (score >= RECOVERY_BANDS.moderate) return 'moderate';
  return 'low';
}

/** Volume load in kg: weight × reps summed over every set. */
export function setsVolume(sets: Pick<WorkoutSet, 'weight' | 'reps'>[]): number {
  return sets.reduce((s, set) => s + set.weight * set.reps, 0);
}

export function sessionVolume(exercises: Pick<WorkoutExercise, 'sets'>[]): number {
  return exercises.reduce((s, we) => s + setsVolume(we.sets), 0);
}

/** Training load is volume load scaled to a readable number (kg ÷ 100). */
export function trainingLoadFromVolume(volumeKg: number): number {
  return Math.round(volumeKg / 100);
}

/** Session intensity from mean RPE; null when no set recorded an RPE. */
export function intensityFromSets(sets: Pick<WorkoutSet, 'rpe'>[]): IntensityLevel | null {
  const avg = mean(sets.map(s => s.rpe).filter((r): r is number => r !== undefined));
  if (avg === null) return null;
  if (avg >= 8.5) return 'very-high';
  if (avg >= 7.5) return 'high';
  if (avg >= 6.5) return 'moderate';
  return 'low';
}

/** Epley estimate. Only meaningful for 1–12 reps with external load. */
export function estimateOneRepMax(weight: number, reps: number): number | null {
  if (weight <= 0 || reps < 1 || reps > 12) return null;
  return reps === 1 ? weight : Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** A set counts toward strength estimates when it was hard (RPE ≥ 7) or RPE was not recorded. */
export function isHardSet(set: Pick<WorkoutSet, 'rpe'>): boolean {
  return set.rpe === undefined || set.rpe >= 7;
}
