import {
  AthleteProfile, Meal, NutritionEntry, NutritionTargets, RecoveryEntry, Workout, WorkoutType,
} from '../models/types';
import { exerciseLibrary } from '../exercises';
import {
  computeRecoveryScore, fatigueFromRecovery, intensityFromSets, sessionVolume, trainingLoadFromVolume,
} from '../domain/scoring';
import { ApiError } from './apiClient';

// ============================================================
// RECORD CONTRACT
// The wire/storage shape of each record. It carries observations
// only: scores, loads, intensities and day totals are never stored
// and are recalculated every time a record is read, so a change to
// a formula applies to all history at once.
//
// These shapes match the kairos-backend (Spring Boot) DTOs; see
// docs/API_CONTRACT.md. Browser storage uses the same shapes so
// records could be migrated as-is.
// ============================================================

export const ENDPOINTS = {
  profile: '/v1/profile',
  trainingSessions: '/v1/training-sessions',
  trainingSession: (id: string) => `/v1/training-sessions/${encodeURIComponent(id)}`,
  recoveryRecords: '/v1/recovery-records',
  recoveryRecord: (date: string) => `/v1/recovery-records/${date}`,
  nutritionDays: '/v1/nutrition-days',
  nutritionDay: (date: string) => `/v1/nutrition-days/${date}`,
} as const;

export type AthleteProfileDto = AthleteProfile;

export interface TrainingSetDto {
  id: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe?: number;
  restSeconds?: number;
  performedAt: string;
}

export interface TrainingSessionDto {
  id: string;
  date: string;
  name: string;
  type: WorkoutType;
  durationMinutes: number;
  exercises: { id: string; exerciseId: string; sets: TrainingSetDto[] }[];
}

export interface RecoveryRecordDto {
  id: string;
  date: string;
  sleepDurationHours: number;
  sleepQuality: number;
  restingHeartRate: number;
  hrvMs?: number;
  soreness: number;
  mood?: number;
  stress?: number;
  source: { provider: string; recordedAt: string };
}

export interface NutritionDayDto {
  id: string;
  date: string;
  hydrationLiters: number | null;
  meals: Meal[];
  targets: NutritionTargets;
}

// --- Record → DTO ---
export function toSessionDto(w: Workout): TrainingSessionDto {
  return {
    id: w.id,
    date: w.date,
    name: w.name,
    type: w.type,
    durationMinutes: w.duration,
    exercises: w.exercises.map(we => ({
      id: we.id,
      exerciseId: we.exerciseId,
      sets: we.sets.map(s => ({
        id: s.id, setNumber: s.setNumber, weightKg: s.weight, reps: s.reps, rpe: s.rpe, restSeconds: s.restTime, performedAt: s.timestamp,
      })),
    })),
  };
}

export function toRecoveryDto(r: RecoveryEntry): RecoveryRecordDto {
  return {
    id: r.id,
    date: r.date,
    sleepDurationHours: r.sleepDuration,
    sleepQuality: r.sleepQuality,
    restingHeartRate: r.restingHR,
    hrvMs: r.hrv,
    soreness: r.soreness,
    mood: r.mood,
    stress: r.stress,
    source: { provider: r.source.provider, recordedAt: r.source.timestamp },
  };
}

export function toNutritionDto(n: NutritionEntry): NutritionDayDto {
  return { id: n.id, date: n.date, hydrationLiters: n.hydration, meals: n.meals, targets: n.targets };
}

// --- DTO → record (derived fields are calculated here) ---
export function fromSessionDto(dto: TrainingSessionDto): Workout {
  const exercises = dto.exercises.flatMap(e => {
    // Sessions referencing an exercise this build does not know are kept out rather than guessed at
    const exercise = exerciseLibrary.find(x => x.id === e.exerciseId);
    if (!exercise) return [];
    return [{
      id: e.id,
      exerciseId: e.exerciseId,
      exercise,
      sets: e.sets.map(s => ({
        id: s.id, exerciseId: e.exerciseId, setNumber: s.setNumber, weight: s.weightKg, reps: s.reps, rpe: s.rpe,
        restTime: s.restSeconds, completed: true, timestamp: s.performedAt,
      })),
    }];
  });
  return {
    id: dto.id,
    date: dto.date,
    name: dto.name,
    type: dto.type,
    exercises,
    duration: dto.durationMinutes,
    trainingLoad: trainingLoadFromVolume(sessionVolume(exercises)),
    intensity: intensityFromSets(exercises.flatMap(we => we.sets)),
    completed: true,
  };
}

export function fromRecoveryDto(dto: RecoveryRecordDto): RecoveryEntry {
  const recoveryScore = computeRecoveryScore({ sleepDuration: dto.sleepDurationHours, restingHR: dto.restingHeartRate, hrv: dto.hrvMs });
  return {
    id: dto.id,
    date: dto.date,
    sleepDuration: dto.sleepDurationHours,
    sleepQuality: dto.sleepQuality,
    restingHR: dto.restingHeartRate,
    hrv: dto.hrvMs,
    recoveryScore,
    fatigue: fatigueFromRecovery(recoveryScore),
    soreness: dto.soreness,
    mood: dto.mood,
    stress: dto.stress,
    source: { provider: dto.source.provider, timestamp: dto.source.recordedAt, confidence: 1 },
  };
}

export function fromNutritionDto(dto: NutritionDayDto): NutritionEntry {
  const total = (key: 'calories' | 'protein' | 'carbohydrates' | 'fat') => dto.meals.reduce((s, m) => s + m[key], 0);
  return {
    id: dto.id,
    date: dto.date,
    calories: total('calories'),
    protein: total('protein'),
    carbohydrates: total('carbohydrates'),
    fat: total('fat'),
    hydration: dto.hydrationLiters,
    meals: dto.meals,
    targets: dto.targets,
  };
}

// --- Response validation ---
type Shape = Record<string, 'string' | 'number' | 'array' | 'object'>;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function check(value: unknown, shape: Shape, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiError('invalid-response', `Expected ${what} to be an object.`);
  }
  const record = value as Record<string, unknown>;
  for (const [key, type] of Object.entries(shape)) {
    const field = record[key];
    const ok = type === 'array' ? Array.isArray(field) : type === 'object' ? typeof field === 'object' && field !== null : typeof field === type;
    if (!ok) throw new ApiError('invalid-response', `${what} is missing a valid “${key}”.`);
  }
  if ('date' in shape && !DATE_KEY.test(record.date as string)) {
    throw new ApiError('invalid-response', `${what} has a date that is not YYYY-MM-DD.`);
  }
  return record;
}

const listOf = <T>(parse: (item: unknown) => T, what: string) => (data: unknown): T[] => {
  if (!Array.isArray(data)) throw new ApiError('invalid-response', `Expected a list of ${what}.`);
  return data.map(parse);
};

export const parseProfile = (data: unknown): AthleteProfileDto =>
  check(data, { id: 'string', name: 'string', discipline: 'string', goal: 'string', trainingFrequency: 'number', equipment: 'array' }, 'The athlete profile') as unknown as AthleteProfileDto;

export const parseSession = (data: unknown): TrainingSessionDto => {
  const session = check(data, { id: 'string', date: 'string', name: 'string', durationMinutes: 'number', exercises: 'array' }, 'A training session');
  for (const exercise of session.exercises as unknown[]) {
    const e = check(exercise, { id: 'string', exerciseId: 'string', sets: 'array' }, 'A session exercise');
    for (const set of e.sets as unknown[]) check(set, { id: 'string', weightKg: 'number', reps: 'number' }, 'A training set');
  }
  return session as unknown as TrainingSessionDto;
};

export const parseRecovery = (data: unknown): RecoveryRecordDto =>
  check(data, { id: 'string', date: 'string', sleepDurationHours: 'number', restingHeartRate: 'number', source: 'object' }, 'A recovery record') as unknown as RecoveryRecordDto;

export const parseNutrition = (data: unknown): NutritionDayDto => {
  const day = check(data, { id: 'string', date: 'string', meals: 'array', targets: 'object' }, 'A nutrition day');
  for (const meal of day.meals as unknown[]) check(meal, { id: 'string', name: 'string', calories: 'number', protein: 'number' }, 'A meal');
  return day as unknown as NutritionDayDto;
};

export const parseSessions = listOf(parseSession, 'training sessions');
export const parseRecoveryList = listOf(parseRecovery, 'recovery records');
export const parseNutritionList = listOf(parseNutrition, 'nutrition days');
