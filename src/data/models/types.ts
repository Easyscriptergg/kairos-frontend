// ============================================================
// KAIROS DATA MODELS
// Core TypeScript interfaces for the entire application
// ============================================================

// --- Athlete Profile ---
export interface AthleteProfile {
  id: string;
  name: string;
  sport: Sport;
  discipline: string;
  experience: ExperienceLevel;
  goal: string;
  trainingFrequency: number; // days per week
  equipment: string[];
  performanceLevel: PerformanceLevel;
  bodyMetrics?: BodyMetrics;
  createdAt: string;
  onboardingComplete: boolean;
}

export type Sport = 'strength' | 'running' | 'cycling' | 'team-sport' | 'combat' | 'hybrid';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type PerformanceLevel = 'recreational' | 'competitive' | 'semi-pro' | 'professional';

export interface BodyMetrics {
  height?: number; // cm
  weight?: number; // kg
  age?: number;
  bodyFat?: number; // percentage
}

// --- Athlete State (Central Object) ---
// Every score is null until the records it is calculated from exist.
export interface AthleteState {
  overallScore: number | null; // 0-100
  readiness: ReadinessLevel | null;
  domains: {
    training: DomainScore;
    recovery: DomainScore;
    nutrition: DomainScore;
    performance: DomainScore;
  };
  trainingLoad: number; // summed over the 7 days ending on the latest record
  fatigue: FatigueLevel | null;
  sleepTrend: TrendDirection;
  nutritionStatus: QualityLevel | null;
  performanceTrend: TrendDirection;
  /** Day key of the most recent record the state was calculated from */
  asOf: string;
}

export interface DomainScore {
  score: number | null;
  trend: TrendDirection;
  label: string;
}

export type ReadinessLevel = 'peak' | 'ready' | 'moderate' | 'fatigued' | 'rest';
export type FatigueLevel = 'low' | 'moderate' | 'high' | 'very-high';
export type TrendDirection = 'improving' | 'stable' | 'declining';
export type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor';
export type TrainingPhase = 'base' | 'development' | 'peak' | 'deload' | 'recovery';

// --- Training ---
export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  category: ExerciseCategory;
  equipment: string[];
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  bodyParts: BodyPart[];
  movementPattern: MovementPattern;
  forceType: ForceType;
  difficulty: ExperienceLevel;
  instructions?: string;
}

export type ExerciseCategory = 'compound' | 'isolation' | 'bodyweight' | 'cardio' | 'plyometric' | 'flexibility';
export type MuscleGroup = 
  | 'chest' | 'front-delts' | 'side-delts' | 'rear-delts'
  | 'upper-back' | 'lats' | 'lower-back' | 'traps'
  | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'hip-flexors'
  | 'abs' | 'obliques';
  
export type BodyPart = 'chest' | 'shoulders' | 'back' | 'arms' | 'legs' | 'core';
export type MovementPattern = 'push' | 'pull' | 'squat' | 'hinge' | 'lunge' | 'carry' | 'rotation' | 'isolation';
export type ForceType = 'push' | 'pull' | 'isometric' | 'dynamic';

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  setNumber: number;
  weight: number; // kg
  reps: number;
  rpe?: number; // 1-10
  restTime?: number; // seconds
  completed: boolean;
  timestamp: string;
  notes?: string;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exercise: Exercise;
  sets: WorkoutSet[];
  notes?: string;
}

export interface Workout {
  id: string;
  date: string;
  name: string;
  type: WorkoutType;
  exercises: WorkoutExercise[];
  duration: number; // minutes
  trainingLoad: number;
  intensity: IntensityLevel | null; // null when no set recorded an RPE
  completed: boolean;
  notes?: string;
  athleteState?: {
    preworkout: number;
    postworkout: number;
  };
}

export type WorkoutType = 'strength' | 'hypertrophy' | 'power' | 'endurance' | 'deload' | 'cardio' | 'sport-specific';
export type IntensityLevel = 'low' | 'moderate' | 'high' | 'very-high';

export interface TrainingPlan {
  id: string;
  name: string;
  phase: TrainingPhase;
  weeklySchedule: PlannedWorkout[];
  startDate: string;
  endDate?: string;
}

export interface PlannedWorkout {
  dayOfWeek: number; // 0-6
  name: string;
  type: WorkoutType;
  targetExercises: string[]; // exercise IDs
  estimatedDuration: number;
}

// --- Recovery ---
export interface RecoveryEntry {
  id: string;
  date: string;
  sleepDuration: number; // hours
  sleepQuality: number; // 1-100
  restingHR: number; // bpm
  hrv?: number; // ms
  recoveryScore: number; // 0-100
  fatigue: FatigueLevel;
  soreness: number; // 1-10
  mood?: number; // 1-10
  stress?: number; // 1-10
  source: DataSource;
  notes?: string;
}

// --- Nutrition ---
export interface NutritionEntry {
  id: string;
  date: string;
  calories: number;
  protein: number; // grams
  carbohydrates: number; // grams
  fat: number; // grams
  hydration: number | null; // liters, null when not logged
  meals: Meal[];
  targets: NutritionTargets;
  notes?: string;
}

export interface Meal {
  id: string;
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
}

export interface NutritionTargets {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  hydration: number;
}

// --- Performance ---
export interface PerformanceEntry {
  id: string;
  date: string;
  sport: Sport;
  metrics: PerformanceMetrics;
  notes?: string;
}

export type PerformanceMetrics = StrengthMetrics | RunningMetrics;

export interface StrengthMetrics {
  type: 'strength';
  estimated1RMs: Record<string, number>; // exerciseId → kg
  totalVolume: number;
  relativeStrength?: number;
  prs: PR[];
  strengthTrend: TrendDirection;
}

export interface RunningMetrics {
  type: 'running';
  distance: number; // km
  pace: number; // min/km
  duration: number; // minutes
  heartRateAvg?: number;
  heartRateMax?: number;
  elevation?: number; // meters
  weeklyMileage: number;
  performanceTrend: TrendDirection;
}

export interface PR {
  exerciseId: string;
  exerciseName: string;
  value: number;
  unit: string;
  date: string;
  previous?: number;
}

// --- Insights ---
export interface Insight {
  id: string;
  type: InsightType;
  category: InsightCategory;
  title: string;
  observation: string;
  evidence: string;
  interpretation: string;
  recommendation: string;
  confidence?: number; // 0-1, only when a model actually reports one
  domains: string[];
  createdAt: string;
  data?: Record<string, unknown>;
}

export type InsightType = 'pattern' | 'anomaly' | 'plateau' | 'improvement' | 'recommendation' | 'warning';
export type InsightCategory = 'sleep-performance' | 'load-fatigue' | 'nutrition-performance' | 'recovery-training' | 'volume-progress' | 'general';

// --- Timeline ---
export interface TimelineEvent {
  id: string;
  date: string;
  time: string;
  type: TimelineEventType;
  title: string;
  description: string;
  value?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
}

export type TimelineEventType = 'training' | 'sleep' | 'nutrition' | 'recovery' | 'performance' | 'milestone' | 'insight';

// --- Connections ---
export interface Connection {
  id: string;
  provider: ConnectionProvider;
  name: string;
  status: ConnectionStatus;
  icon: string;
  color: string;
  availableDataTypes: string[];
  lastSync?: string;
  permissions: string[];
}

export type ConnectionProvider = 'apple-health' | 'health-connect' | 'garmin' | 'whoop' | 'oura' | 'fitbit' | 'strava' | 'polar' | 'coros';
export type ConnectionStatus = 'connected' | 'disconnected' | 'pending' | 'error';

// --- Data Source ---
export interface DataSource {
  provider: string;
  timestamp: string;
  confidence: number; // 0-1
}

// --- Kairos Recommendation ---
export interface KairosRecommendation {
  id: string;
  title: string;
  message: string;
  reasoning: string;
  action: string;
  actionLabel: string;
  priority: 'high' | 'medium' | 'low';
  domains: string[];
  createdAt: string;
}

// --- Application ---
/** Where records come from: bundled sample data, this browser's storage, or the REST API. */
export type DataMode = 'demo' | 'local' | 'api';

export type UnitSystem = 'metric' | 'imperial';
export type RecommendationSensitivity = 'conservative' | 'balanced' | 'aggressive';

export interface AppSettings {
  unitSystem: UnitSystem;
  sensitivity: RecommendationSensitivity;
}

/** The canonical, persisted records. Everything else in the store is derived from these. */
export interface AthleteRecords {
  profile: AthleteProfile | null;
  recovery: RecoveryEntry[];
  workouts: Workout[];
  nutrition: NutritionEntry[];
}