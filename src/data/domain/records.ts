import {
  Meal, NutritionEntry, NutritionTargets, RecoveryEntry, Workout, WorkoutExercise, WorkoutSet, WorkoutType,
} from '../models/types';
import { exerciseLibrary } from '../exercises';
import {
  computeRecoveryScore, fatigueFromRecovery, intensityFromSets, sessionVolume, trainingLoadFromVolume,
} from './scoring';

// ============================================================
// RECORD BUILDERS
// Turn form input into canonical records. Pages never assemble
// records themselves, so every derived field (score, load,
// intensity, totals) is calculated the same way everywhere.
// ============================================================

/** Used for a day's first meal when no earlier day carries targets. Editing targets is not built yet. */
export const DEFAULT_NUTRITION_TARGETS: NutritionTargets = {
  calories: 2600,
  protein: 165,
  carbohydrates: 320,
  fat: 75,
  hydration: 3.0,
};

export function newId(prefix: string): string {
  const unique = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.round(performance.now() * 1000).toString(36)}`;
  return `${prefix}-${unique}`;
}

export interface LoggedSetInput {
  exerciseId: string;
  weight: number;
  reps: number;
  rpe?: number;
}

export interface WorkoutInput {
  name: string;
  date: string;
  durationMinutes: number;
  type: WorkoutType;
  sets: LoggedSetInput[];
}

export function buildWorkout(input: WorkoutInput): Workout {
  const timestamp = new Date().toISOString();
  const exerciseIds = [...new Set(input.sets.map(s => s.exerciseId))];

  const exercises: WorkoutExercise[] = exerciseIds.flatMap(exerciseId => {
    const exercise = exerciseLibrary.find(e => e.id === exerciseId);
    if (!exercise) return [];
    const sets: WorkoutSet[] = input.sets
      .filter(s => s.exerciseId === exerciseId)
      .map((s, i) => ({
        id: newId('set'),
        exerciseId,
        setNumber: i + 1,
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        completed: true,
        timestamp,
      }));
    return [{ id: newId('we'), exerciseId, exercise, sets }];
  });

  return {
    id: newId('workout'),
    date: input.date,
    name: input.name.trim() || 'Untitled session',
    type: input.type,
    exercises,
    duration: input.durationMinutes,
    trainingLoad: trainingLoadFromVolume(sessionVolume(exercises)),
    intensity: intensityFromSets(exercises.flatMap(we => we.sets)),
    completed: true,
  };
}

export interface RecoveryInput {
  date: string;
  sleepDuration: number;
  sleepQuality: number;
  restingHR: number;
  hrv?: number;
  soreness: number;
}

/** One recovery record per day: a second check-in on the same day replaces the first. */
export function buildRecoveryEntry(input: RecoveryInput, provider = 'manual'): RecoveryEntry {
  const recoveryScore = computeRecoveryScore(input);
  return {
    id: `recovery-${input.date}`,
    date: input.date,
    sleepDuration: input.sleepDuration,
    sleepQuality: input.sleepQuality,
    restingHR: input.restingHR,
    hrv: input.hrv,
    recoveryScore,
    fatigue: fatigueFromRecovery(recoveryScore),
    soreness: input.soreness,
    source: { provider, timestamp: new Date().toISOString(), confidence: 1 },
  };
}

export type MealInput = Omit<Meal, 'id'>;

/** Adds a meal to a day, creating the day if needed. Day totals are always the sum of its meals. */
export function addMealToDay(day: NutritionEntry | null, date: string, meal: MealInput, targets: NutritionTargets): NutritionEntry {
  const meals = [...(day?.meals ?? []), { ...meal, id: newId('meal') }];
  const total = (key: 'calories' | 'protein' | 'carbohydrates' | 'fat') => meals.reduce((s, m) => s + m[key], 0);
  return {
    id: day?.id ?? `nutrition-${date}`,
    date,
    calories: total('calories'),
    protein: total('protein'),
    carbohydrates: total('carbohydrates'),
    fat: total('fat'),
    hydration: day?.hydration ?? null,
    meals,
    targets: day?.targets ?? targets,
  };
}
