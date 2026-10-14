import {
  AthleteProfile, AthleteRecords, DataMode, NutritionEntry, RecoveryEntry, Workout,
} from '../models/types';
import { buildDemoRecords } from '../demo/seedData';
import { API_BASE_URL, apiRequest } from './apiClient';
import {
  AthleteProfileDto, ENDPOINTS, NutritionDayDto, RecoveryRecordDto, TrainingSessionDto,
  fromNutritionDto, fromRecoveryDto, fromSessionDto,
  parseNutrition, parseNutritionList, parseProfile, parseRecovery, parseRecoveryList, parseSession, parseSessions,
  toNutritionDto, toRecoveryDto, toSessionDto,
} from './contract';

// ============================================================
// REPOSITORIES
// One interface, three sources of records:
//   demo  — the bundled sample athlete, plus anything logged while
//           exploring it (kept apart from real data)
//   local — the athlete's own records in this browser's storage
//   api   — the REST backend at VITE_API_BASE_URL
// A save resolves only once the record is actually stored.
// ============================================================

export interface KairosRepository {
  readonly mode: DataMode;
  load(signal?: AbortSignal): Promise<AthleteRecords>;
  saveProfile(profile: AthleteProfile): Promise<AthleteProfile>;
  saveWorkout(workout: Workout): Promise<Workout>;
  /** Replaces any existing record for the same day */
  saveRecovery(entry: RecoveryEntry): Promise<RecoveryEntry>;
  /** Replaces any existing record for the same day */
  saveNutritionDay(day: NutritionEntry): Promise<NutritionEntry>;
  /** Deletes everything this repository has stored. Not offered for the API. */
  clear(): Promise<void>;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

// --- Browser storage ---
interface StoredRecords {
  profile: AthleteProfileDto | null;
  sessions: TrainingSessionDto[];
  recovery: RecoveryRecordDto[];
  nutrition: NutritionDayDto[];
}

const EMPTY: StoredRecords = { profile: null, sessions: [], recovery: [], nutrition: [] };
const storageKey = (mode: 'demo' | 'local') => `kairos.v1.records.${mode}`;

function readStored(mode: 'demo' | 'local'): StoredRecords {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(mode));
  } catch {
    throw new StorageError('This browser is blocking storage, so records cannot be read or saved on this device.');
  }
  if (raw === null) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredRecords>;
    return {
      profile: parsed.profile ? parseProfile(parsed.profile) : null,
      sessions: parseSessions(parsed.sessions ?? []),
      recovery: parseRecoveryList(parsed.recovery ?? []),
      nutrition: parseNutritionList(parsed.nutrition ?? []),
    };
  } catch {
    throw new StorageError('The records saved on this device could not be read. Clear them in Settings to start again.');
  }
}

function writeStored(mode: 'demo' | 'local', records: StoredRecords): void {
  try {
    localStorage.setItem(storageKey(mode), JSON.stringify(records));
  } catch {
    throw new StorageError('The record could not be saved on this device — browser storage is full or blocked.');
  }
}

const upsertByDate = <T extends { date: string }>(items: T[], item: T): T[] =>
  [...items.filter(i => i.date !== item.date), item].sort((a, b) => a.date.localeCompare(b.date));

function browserRepository(mode: 'demo' | 'local'): KairosRepository {
  const update = (change: (stored: StoredRecords) => StoredRecords) => writeStored(mode, change(readStored(mode)));

  return {
    mode,
    async load() {
      const stored = readStored(mode);
      const logged: AthleteRecords = {
        profile: stored.profile,
        workouts: stored.sessions.map(fromSessionDto),
        recovery: stored.recovery.map(fromRecoveryDto),
        nutrition: stored.nutrition.map(fromNutritionDto),
      };
      if (mode === 'local') return logged;

      // Demo: sample records first, then whatever was logged on top of them
      const demo = buildDemoRecords();
      return {
        profile: logged.profile ?? demo.profile,
        workouts: [...demo.workouts, ...logged.workouts].sort((a, b) => a.date.localeCompare(b.date)),
        recovery: logged.recovery.reduce(upsertByDate, demo.recovery),
        nutrition: logged.nutrition.reduce(upsertByDate, demo.nutrition),
      };
    },
    async saveProfile(profile) {
      update(s => ({ ...s, profile }));
      return profile;
    },
    async saveWorkout(workout) {
      update(s => ({ ...s, sessions: [...s.sessions.filter(x => x.id !== workout.id), toSessionDto(workout)] }));
      return workout;
    },
    async saveRecovery(entry) {
      update(s => ({ ...s, recovery: upsertByDate(s.recovery, toRecoveryDto(entry)) }));
      return entry;
    },
    async saveNutritionDay(day) {
      update(s => ({ ...s, nutrition: upsertByDate(s.nutrition, toNutritionDto(day)) }));
      return day;
    },
    async clear() {
      try {
        localStorage.removeItem(storageKey(mode));
      } catch {
        throw new StorageError('This browser is blocking storage, so the records could not be cleared.');
      }
    },
  };
}

// --- REST API ---
const apiRepository: KairosRepository = {
  mode: 'api',
  async load(signal) {
    const [profile, sessions, recovery, nutrition] = await Promise.all([
      apiRequest(ENDPOINTS.profile, parseProfile, { signal, allowNotFound: true }),
      apiRequest(ENDPOINTS.trainingSessions, parseSessions, { signal }),
      apiRequest(ENDPOINTS.recoveryRecords, parseRecoveryList, { signal }),
      apiRequest(ENDPOINTS.nutritionDays, parseNutritionList, { signal }),
    ]);
    const byDate = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date);
    return {
      profile,
      workouts: sessions.map(fromSessionDto).sort(byDate),
      recovery: recovery.map(fromRecoveryDto).sort(byDate),
      nutrition: nutrition.map(fromNutritionDto).sort(byDate),
    };
  },
  saveProfile: profile => apiRequest(ENDPOINTS.profile, parseProfile, { method: 'PUT', body: profile }),
  async saveWorkout(workout) {
    return fromSessionDto(await apiRequest(ENDPOINTS.trainingSessions, parseSession, { method: 'POST', body: toSessionDto(workout) }));
  },
  async saveRecovery(entry) {
    return fromRecoveryDto(await apiRequest(ENDPOINTS.recoveryRecord(entry.date), parseRecovery, { method: 'PUT', body: toRecoveryDto(entry) }));
  },
  async saveNutritionDay(day) {
    return fromNutritionDto(await apiRequest(ENDPOINTS.nutritionDay(day.date), parseNutrition, { method: 'PUT', body: toNutritionDto(day) }));
  },
  async clear() {
    throw new StorageError('Records held by the API cannot be cleared from the app.');
  },
};

export const isApiConfigured = API_BASE_URL !== null;

export function createRepository(mode: DataMode): KairosRepository {
  return mode === 'api' ? apiRepository : browserRepository(mode);
}
