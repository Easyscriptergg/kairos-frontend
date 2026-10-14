import {
  AthleteProfile, AthleteRecords, Workout, WorkoutExercise, WorkoutSet,
  RecoveryEntry, NutritionEntry, Meal, NutritionTargets,
} from '../models/types';
import { exerciseLibrary } from '../exercises';
import { addDays, todayKey } from '../domain/dates';
import {
  computeRecoveryScore, fatigueFromRecovery, intensityFromSets, sessionVolume, trainingLoadFromVolume,
} from '../domain/scoring';
import { DEFAULT_NUTRITION_TARGETS } from '../domain/records';

// ============================================================
// KAIROS DEMO DATASET
// 30 days of internally consistent sample data for one athlete.
// Story: Progressive strength training cycle with a deload
// Higher sleep → better recovery → better sessions
// Load ramp → increased fatigue → deload → rebound
//
// The dataset is fully deterministic: every value depends only on
// its day index, so it is identical on every load. Only the dates
// move — day 29 is always yesterday. Scores, loads, performance and
// insights are NOT stored here; they are calculated from these
// records by the same code that handles real records.
// ============================================================

export const DEMO_DAYS = 30;

/** Stable pseudo-random value in [0, 1) for a given day and purpose. */
function noise(day: number, salt: number): number {
  let h = (day + 1) * 374761393 + (salt + 1) * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return ((h >>> 0) % 10000) / 10000;
}

// --- Athlete Profile ---
export const demoProfile: AthleteProfile = {
  id: 'athlete-demo',
  name: 'Harshal',
  sport: 'strength',
  discipline: 'Powerbuilding',
  experience: 'intermediate',
  goal: 'Build strength and muscle while maintaining performance',
  trainingFrequency: 4,
  equipment: ['barbell', 'dumbbells', 'cable-machine', 'machine', 'bench', 'squat-rack', 'pull-up-bar'],
  performanceLevel: 'competitive',
  bodyMetrics: {
    height: 178,
    weight: 82,
    age: 27,
  },
  createdAt: '',
  onboardingComplete: true,
};

// ============================================================
// SLEEP/RECOVERY STORY (30 days)
// Week 1: Good sleep (7.5-8.5h), good recovery
// Week 2: Sleep dips (6-7h), recovery drops
// Week 3: Sleep improves (7-8h), recovery rebounds
// Week 4: Deload week, sleep good (7.5-8.5h), recovery peaks
// Last 2 days: Fresh and ready
// ============================================================

const sleepPattern = [
  // Week 1 (Day 0-6): Good foundation
  7.8, 8.2, 7.5, 8.0, 7.7, 8.5, 8.1,
  // Week 2 (Day 7-13): Sleep disruption, fatigue building
  6.5, 6.2, 7.0, 6.3, 6.8, 7.1, 6.0,
  // Week 3 (Day 14-20): Recovery focus, sleep improving
  7.2, 7.5, 7.8, 7.3, 8.0, 7.6, 8.2,
  // Week 4 (Day 21-27): Deload, prioritizing recovery
  8.0, 8.3, 7.8, 8.5, 8.1, 8.4, 7.9,
  // Last 2 days (Day 28-29): Peak readiness
  8.2, 8.0,
];

const restingHRPattern = [
  // Week 1
  58, 57, 59, 58, 57, 56, 57,
  // Week 2: HR elevates with poor sleep
  62, 64, 61, 63, 62, 60, 65,
  // Week 3: Improving
  60, 59, 58, 59, 57, 58, 56,
  // Week 4: Deload - low HR
  56, 55, 56, 54, 55, 54, 55,
  // Last 2 days
  55, 56,
];

const hrvPattern = [
  // Week 1
  62, 65, 60, 63, 64, 68, 66,
  // Week 2: HRV drops
  52, 48, 54, 50, 53, 55, 45,
  // Week 3: Rebuilding
  56, 58, 61, 59, 63, 62, 65,
  // Week 4: Deload - HRV peaks
  66, 68, 65, 70, 69, 71, 68,
  // Last 2 days
  68, 67,
];

function generateRecoveryData(dateOf: (day: number) => string): RecoveryEntry[] {
  return sleepPattern.map((sleep, i) => {
    const hrv = hrvPattern[i];
    const restingHR = restingHRPattern[i];
    const recoveryScore = computeRecoveryScore({ sleepDuration: sleep, hrv, restingHR });
    const stressedWeek = i >= 7 && i <= 13;

    return {
      id: `demo-recovery-${i}`,
      date: dateOf(i),
      sleepDuration: sleep,
      sleepQuality: Math.round(Math.min(100, (sleep / 9) * 100)),
      restingHR,
      hrv,
      recoveryScore,
      fatigue: fatigueFromRecovery(recoveryScore),
      soreness: stressedWeek ? Math.round(5 + noise(i, 1) * 2) : Math.round(3 + noise(i, 1) * 2),
      mood: recoveryScore > 75 ? Math.round(7 + noise(i, 2) * 2) : Math.round(5 + noise(i, 2) * 2),
      stress: stressedWeek ? Math.round(6 + noise(i, 3) * 2) : Math.round(3 + noise(i, 3) * 2),
      source: {
        provider: 'demo',
        timestamp: `${dateOf(i)}T07:00:00`,
        confidence: 1,
      },
    };
  });
}

// ============================================================
// TRAINING STORY (30 days)
// 4-day Upper/Lower split
// Week 1: Moderate load, good performance
// Week 2: Push harder, fatigue building
// Week 3: Maintain, recovery improving
// Week 4: Deload (reduced volume/intensity)
// Week 5: New block begins
// ============================================================

const upperAExercises = ['bench-press', 'barbell-row', 'overhead-press', 'lat-pulldown', 'lateral-raise', 'barbell-curl', 'tricep-pushdown'];
const lowerAExercises = ['barbell-squat', 'romanian-deadlift', 'leg-press', 'leg-curl', 'calf-raise', 'cable-crunch'];
const upperBExercises = ['incline-bench-press', 'seated-cable-row', 'dumbbell-bench-press', 'pull-up', 'face-pull', 'dumbbell-curl', 'skull-crusher'];
const lowerBExercises = ['deadlift', 'barbell-squat', 'leg-extension', 'leg-curl', 'calf-raise', 'hanging-leg-raise'];

interface WorkoutTemplate {
  name: string;
  type: 'strength' | 'hypertrophy';
  exerciseIds: string[];
}

const weeklyTemplates: WorkoutTemplate[] = [
  { name: 'Upper Body A', type: 'strength', exerciseIds: upperAExercises },
  { name: 'Lower Body A', type: 'strength', exerciseIds: lowerAExercises },
  { name: 'Upper Body B', type: 'hypertrophy', exerciseIds: upperBExercises },
  { name: 'Lower Body B', type: 'hypertrophy', exerciseIds: lowerBExercises },
];

// Training days within each 7-day block of the dataset (two on, one off, two on, two off)
const trainingDays = [0, 1, 3, 4];
const isTrainingDay = (day: number) => trainingDays.includes(day % 7);

const DELOAD_WEEK = 3;

function getWeekMultiplier(weekNum: number): { load: number; volume: number } {
  switch (weekNum) {
    case 0: return { load: 1.0, volume: 1.0 };   // Week 1: Baseline
    case 1: return { load: 1.08, volume: 1.1 };   // Week 2: Push
    case 2: return { load: 1.05, volume: 1.05 };  // Week 3: Maintain
    case 3: return { load: 0.7, volume: 0.6 };    // Week 4: Deload
    default: return { load: 1.08, volume: 1.0 };  // Week 5: New block
  }
}

// Base weights for exercises (kg)
const baseWeights: Record<string, number> = {
  'bench-press': 85, 'incline-bench-press': 70, 'dumbbell-bench-press': 32,
  'cable-fly': 15, 'nautilus-chest-press': 75,
  'barbell-row': 80, 'pull-up': 0, 'lat-pulldown': 65, 'seated-cable-row': 60,
  'deadlift': 140, 'overhead-press': 55, 'lateral-raise': 12, 'face-pull': 20,
  'barbell-squat': 110, 'leg-press': 180, 'romanian-deadlift': 90,
  'leg-curl': 45, 'leg-extension': 55, 'calf-raise': 80,
  'barbell-curl': 35, 'tricep-pushdown': 28, 'dumbbell-curl': 14,
  'skull-crusher': 30, 'cable-crunch': 35, 'hanging-leg-raise': 0, 'plank': 0,
};

function generateSets(exerciseId: string, day: number, date: string, recoveryScore: number): WorkoutSet[] {
  const weekNum = Math.floor(day / 7);
  const mult = getWeekMultiplier(weekNum);
  const baseWeight = baseWeights[exerciseId] ?? 50;
  const isBodyweight = baseWeight === 0;
  const isAccessory = exerciseId.includes('curl') || exerciseId.includes('raise') || exerciseId.includes('crunch') || exerciseId.includes('face');
  const numSets = weekNum === DELOAD_WEEK ? 2 : isAccessory ? 3 : 4;

  // Better recovery → better performance
  const recoveryBonus = recoveryScore > 80 ? 1.03 : recoveryScore < 60 ? 0.95 : 1.0;

  const sets: WorkoutSet[] = [];
  for (let s = 0; s < numSets; s++) {
    const weight = isBodyweight ? 0 : Math.round(baseWeight * mult.load * recoveryBonus * (1 - s * 0.03));
    const baseReps = isBodyweight ? 10 : (exerciseId.includes('deadlift') ? 5 : exerciseId.includes('squat') || exerciseId.includes('bench') || exerciseId.includes('press') && !exerciseId.includes('leg') ? 6 : 10);
    const reps = Math.max(3, Math.round(baseReps * (1 - s * 0.08) * (weekNum === DELOAD_WEEK ? 1.3 : 1)));
    const rpe = Math.min(10, weekNum === DELOAD_WEEK ? 6 + noise(day, 10 + s) * 0.8 : 7 + s * 0.5 + (weekNum === 1 ? 0.5 : 0));

    sets.push({
      id: `demo-set-${day}-${exerciseId}-${s}`,
      exerciseId,
      setNumber: s + 1,
      weight,
      reps,
      rpe: Math.round(rpe * 10) / 10,
      restTime: exerciseId.includes('squat') || exerciseId.includes('deadlift') || exerciseId.includes('bench') ? 180 : 90,
      completed: true,
      timestamp: `${date}T17:30:00`,
    });
  }
  return sets;
}

function generateWorkoutData(dateOf: (day: number) => string, recoveryData: RecoveryEntry[]): Workout[] {
  const workouts: Workout[] = [];
  let templateIdx = 0;

  for (let day = 0; day < DEMO_DAYS; day++) {
    if (!isTrainingDay(day)) continue;

    const weekNum = Math.floor(day / 7);
    const template = weeklyTemplates[templateIdx % 4];
    templateIdx++;

    const date = dateOf(day);
    const recoveryScore = recoveryData[day].recoveryScore;

    const exercises: WorkoutExercise[] = template.exerciseIds.flatMap(eid => {
      const exercise = exerciseLibrary.find(e => e.id === eid);
      if (!exercise) return [];
      return [{
        id: `demo-we-${day}-${eid}`,
        exerciseId: eid,
        exercise,
        sets: generateSets(eid, day, date, recoveryScore),
      }];
    });

    workouts.push({
      id: `demo-workout-${day}`,
      date,
      name: template.name,
      type: template.type,
      exercises,
      duration: weekNum === DELOAD_WEEK ? Math.round(40 + noise(day, 20) * 15) : Math.round(55 + noise(day, 20) * 25),
      trainingLoad: trainingLoadFromVolume(sessionVolume(exercises)),
      intensity: intensityFromSets(exercises.flatMap(we => we.sets)),
      completed: true,
    });
  }

  return workouts;
}

// ============================================================
// NUTRITION STORY
// Consistent eating with correlation to performance
// Higher carb days before heavy sessions
// Week 2: slight drop (stress/poor sleep)
// ============================================================

function generateNutritionData(dateOf: (day: number) => string): NutritionEntry[] {
  const targets: NutritionTargets = DEFAULT_NUTRITION_TARGETS;

  return Array.from({ length: DEMO_DAYS }, (_, i) => {
    const weekNum = Math.floor(i / 7);
    const trainingDay = isTrainingDay(i);

    // Base multiplier
    let calMult = trainingDay ? 1.02 : 0.92;
    let carbMult = trainingDay ? 1.1 : 0.85;

    // Week 2: under-eating slightly due to stress
    if (weekNum === 1) {
      calMult *= 0.88;
      carbMult *= 0.82;
    }

    const plan = {
      calories: targets.calories * calMult * (0.95 + noise(i, 30) * 0.1),
      protein: targets.protein * (0.88 + noise(i, 31) * 0.2),
      carbohydrates: targets.carbohydrates * carbMult * (0.9 + noise(i, 32) * 0.15),
      fat: targets.fat * (0.85 + noise(i, 33) * 0.25),
    };
    const hydration = Math.round((weekNum === 1 ? 2.2 : 2.6) * (0.85 + noise(i, 34) * 0.3) * 10) / 10;

    // [name, time, share of calories, protein, carbohydrates, fat]
    const mealPlan: [string, string, number, number, number, number][] = [
      ['Breakfast', '07:30', 0.25, 0.25, 0.3, 0.25],
      ['Lunch', '12:30', 0.35, 0.35, 0.3, 0.35],
      [trainingDay ? 'Pre-Workout' : 'Snack', trainingDay ? '16:00' : '15:30', 0.1, 0.1, 0.2, 0.05],
      ['Dinner', '19:30', 0.3, 0.3, 0.2, 0.35],
    ];
    const meals: Meal[] = mealPlan.map(([name, time, cal, protein, carbs, fat], m) => ({
      id: `demo-meal-${i}-${m}`,
      name,
      time,
      calories: Math.round(plan.calories * cal),
      protein: Math.round(plan.protein * protein),
      carbohydrates: Math.round(plan.carbohydrates * carbs),
      fat: Math.round(plan.fat * fat),
    }));

    // Day totals are the sum of the meals, exactly as for logged days
    const total = (key: 'calories' | 'protein' | 'carbohydrates' | 'fat') => meals.reduce((s, meal) => s + meal[key], 0);

    return {
      id: `demo-nutrition-${i}`,
      date: dateOf(i),
      calories: total('calories'),
      protein: total('protein'),
      carbohydrates: total('carbohydrates'),
      fat: total('fat'),
      hydration,
      meals,
      targets,
    };
  });
}

// ============================================================
// MASTER BUILD — the demo athlete's canonical records
// ============================================================

export function buildDemoRecords(): AthleteRecords {
  const lastDay = addDays(todayKey(), -1);
  const dateOf = (day: number) => addDays(lastDay, day - (DEMO_DAYS - 1));

  const recovery = generateRecoveryData(dateOf);
  return {
    profile: { ...demoProfile, createdAt: dateOf(0) },
    recovery,
    workouts: generateWorkoutData(dateOf, recovery),
    nutrition: generateNutritionData(dateOf),
  };
}
