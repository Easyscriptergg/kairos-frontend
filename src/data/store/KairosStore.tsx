import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, ReactNode } from 'react';
import {
  AppSettings, AthleteProfile, AthleteRecords, Connection, DataMode,
} from '../models/types';
import { DerivedState, deriveAll } from '../domain/derive';
import {
  DEFAULT_NUTRITION_TARGETS, MealInput, RecoveryInput, WorkoutInput,
  addMealToDay, buildRecoveryEntry, buildWorkout,
} from '../domain/records';
import { providerCatalog } from '../providers';
import { createRepository, isApiConfigured } from '../api/repository';
import { setUnauthorizedHandler } from '../api/apiClient';
import { getSession } from '../api/session';
import * as accounts from '../api/auth';

// ============================================================
// KAIROS DATA STORE
// Central React Context providing all application data.
//
// The store holds the canonical records for the active data source
// and everything derived from them. Records only change after the
// repository confirms a save, so what is on screen is always what
// is stored.
// ============================================================

/** 'signed-out' only occurs for the API source, before sign-in or after the session expires. */
type LoadStatus = 'loading' | 'ready' | 'error' | 'signed-out';

interface KairosState extends AthleteRecords, DerivedState {
  mode: DataMode;
  status: LoadStatus;
  /** Why loading failed (status 'error'), or why the athlete was signed out */
  error: string | null;
  /** Why the most recent save failed; cleared on the next successful save */
  saveError: string | null;
  /** The signed-in Kairos account, for the API source */
  account: { email: string } | null;
  settings: AppSettings;
  connections: Connection[];
  isLoading: boolean;
}

type KairosAction =
  | { type: 'LOAD_START'; mode: DataMode }
  | { type: 'LOADED'; records: AthleteRecords }
  | { type: 'LOAD_FAILED'; error: string }
  | { type: 'SIGNED_OUT'; mode: DataMode; reason: string | null }
  | { type: 'SIGNED_IN'; email: string }
  | { type: 'RECORDS_CHANGED'; records: Partial<AthleteRecords> }
  | { type: 'SETTINGS_CHANGED'; settings: AppSettings }
  | { type: 'SAVE_FAILED'; error: string }
  | { type: 'SAVE_ERROR_DISMISSED' };

const EMPTY_RECORDS: AthleteRecords = { profile: null, recovery: [], workouts: [], nutrition: [] };
const DEFAULT_SETTINGS: AppSettings = { unitSystem: 'metric', sensitivity: 'balanced' };

const MODE_KEY = 'kairos.v1.mode';
const SETTINGS_KEY = 'kairos.v1.settings';

// Preferences are a convenience: if storage is unavailable the defaults simply apply
function readPreference<T>(key: string, fallback: T, isValid: (value: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not persisted; the choice still applies for this session
  }
}

function initialMode(): DataMode {
  const stored = readPreference<DataMode | null>(MODE_KEY, null, v => v === 'demo' || v === 'local' || v === 'api');
  if (stored && (stored !== 'api' || isApiConfigured)) return stored;
  return isApiConfigured ? 'api' : 'demo';
}

function initialState(): KairosState {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...readPreference<Partial<AppSettings>>(SETTINGS_KEY, {}, v => typeof v === 'object' && v !== null),
  };
  const session = getSession();
  return {
    ...EMPTY_RECORDS,
    ...deriveAll(EMPTY_RECORDS, settings),
    mode: initialMode(),
    status: 'loading',
    error: null,
    saveError: null,
    account: session ? { email: session.email } : null,
    settings,
    connections: providerCatalog,
    isLoading: true,
  };
}

const recordsOf = (state: KairosState): AthleteRecords => ({
  profile: state.profile,
  recovery: state.recovery,
  workouts: state.workouts,
  nutrition: state.nutrition,
});

function withRecords(state: KairosState, records: AthleteRecords, settings = state.settings): KairosState {
  return { ...state, ...records, ...deriveAll(records, settings), settings };
}

function kairosReducer(state: KairosState, action: KairosAction): KairosState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...withRecords(state, EMPTY_RECORDS), mode: action.mode, status: 'loading', isLoading: true, error: null, saveError: null };

    case 'LOADED':
      return { ...withRecords(state, action.records), status: 'ready', isLoading: false, error: null };

    case 'LOAD_FAILED':
      return { ...state, status: 'error', isLoading: false, error: action.error };

    // Signing out drops the account's records from memory immediately
    case 'SIGNED_OUT':
      return { ...withRecords(state, EMPTY_RECORDS), mode: action.mode, status: 'signed-out', isLoading: false, error: action.reason, saveError: null, account: null };

    case 'SIGNED_IN':
      return { ...state, account: { email: action.email }, error: null };

    case 'RECORDS_CHANGED':
      return { ...withRecords(state, { ...recordsOf(state), ...action.records }), saveError: null };

    case 'SETTINGS_CHANGED':
      return withRecords(state, recordsOf(state), action.settings);

    case 'SAVE_FAILED':
      return { ...state, saveError: action.error };

    case 'SAVE_ERROR_DISMISSED':
      return { ...state, saveError: null };

    default:
      return state;
  }
}

export interface KairosActions {
  /** Switch data source. Records are never copied between sources. */
  setMode: (mode: DataMode) => void;
  reload: () => void;
  /** Each log action resolves true once the record is stored, false if the save failed. */
  logWorkout: (input: WorkoutInput) => Promise<boolean>;
  deleteWorkout: (id: string) => Promise<boolean>;
  logRecovery: (input: RecoveryInput) => Promise<boolean>;
  logMeal: (date: string, meal: MealInput) => Promise<boolean>;
  saveProfile: (profile: AthleteProfile) => Promise<boolean>;
  updateSettings: (patch: Partial<AppSettings>) => void;
  /** Deletes what the active source has stored in this browser (demo: only what was logged on top of the sample data). */
  clearStoredRecords: () => Promise<boolean>;
  dismissSaveError: () => void;
  /** Resolve to an error message, or null on success */
  signIn: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string) => Promise<string | null>;
  signOut: () => void;
}

interface KairosContextType {
  state: KairosState;
  actions: KairosActions;
}

const KairosContext = createContext<KairosContextType | null>(null);

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong.');
const byDate = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date);

export function KairosProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(kairosReducer, undefined, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const loadRef = useRef<AbortController | null>(null);

  const load = useCallback((mode: DataMode) => {
    // A newer load supersedes any still in flight, so a slow response can never overwrite a later one
    loadRef.current?.abort();
    if (mode === 'api' && !getSession()) {
      dispatch({ type: 'SIGNED_OUT', mode, reason: null });
      return;
    }
    const controller = new AbortController();
    loadRef.current = controller;
    dispatch({ type: 'LOAD_START', mode });

    createRepository(mode).load(controller.signal).then(
      records => {
        if (!controller.signal.aborted) dispatch({ type: 'LOADED', records });
      },
      error => {
        if (controller.signal.aborted) return;
        // A 401 has already moved the app to the signed-out state
        if (stateRef.current.status !== 'signed-out') dispatch({ type: 'LOAD_FAILED', error: messageOf(error) });
      },
    );
  }, []);

  useEffect(() => {
    // Any request the API rejects for authentication signs the athlete out of the app too
    setUnauthorizedHandler(() => {
      if (stateRef.current.mode === 'api') {
        loadRef.current?.abort();
        dispatch({ type: 'SIGNED_OUT', mode: 'api', reason: 'Your session has expired. Sign in again to continue.' });
      }
    });
    load(stateRef.current.mode);
    return () => {
      setUnauthorizedHandler(null);
      loadRef.current?.abort();
    };
  }, [load]);

  const actions = useMemo<KairosActions>(() => {
    const save = async (run: (current: KairosState) => Promise<Partial<AthleteRecords>>): Promise<boolean> => {
      const { mode } = stateRef.current;
      try {
        const records = await run(stateRef.current);
        // Ignore a save that finished after the athlete switched data source
        if (stateRef.current.mode === mode) dispatch({ type: 'RECORDS_CHANGED', records });
        return true;
      } catch (error) {
        if (stateRef.current.status !== 'signed-out') dispatch({ type: 'SAVE_FAILED', error: messageOf(error) });
        return false;
      }
    };

    const authenticate = async (run: () => Promise<{ email: string }>): Promise<string | null> => {
      try {
        const session = await run();
        dispatch({ type: 'SIGNED_IN', email: session.email });
        writePreference(MODE_KEY, 'api');
        load('api');
        return null;
      } catch (error) {
        return messageOf(error);
      }
    };

    return {
      setMode: mode => {
        writePreference(MODE_KEY, mode);
        load(mode);
      },
      reload: () => load(stateRef.current.mode),

      logWorkout: input => save(async current => {
        const saved = await createRepository(current.mode).saveWorkout(buildWorkout(input));
        return { workouts: [...current.workouts, saved].sort(byDate) };
      }),

      deleteWorkout: id => save(async current => {
        await createRepository(current.mode).deleteWorkout(id);
        return { workouts: current.workouts.filter(w => w.id !== id) };
      }),

      logRecovery: input => save(async current => {
        const saved = await createRepository(current.mode).saveRecovery(buildRecoveryEntry(input));
        return { recovery: [...current.recovery.filter(r => r.date !== saved.date), saved].sort(byDate) };
      }),

      logMeal: (date, meal) => save(async current => {
        const existing = current.nutrition.find(n => n.date === date) ?? null;
        const targets = current.nutrition[current.nutrition.length - 1]?.targets ?? DEFAULT_NUTRITION_TARGETS;
        const saved = await createRepository(current.mode).saveNutritionDay(addMealToDay(existing, date, meal, targets));
        return { nutrition: [...current.nutrition.filter(n => n.date !== saved.date), saved].sort(byDate) };
      }),

      saveProfile: profile => save(async current => ({
        profile: await createRepository(current.mode).saveProfile(profile),
      })),

      updateSettings: patch => {
        const settings = { ...stateRef.current.settings, ...patch };
        writePreference(SETTINGS_KEY, settings);
        dispatch({ type: 'SETTINGS_CHANGED', settings });
      },

      clearStoredRecords: async () => {
        const { mode } = stateRef.current;
        try {
          await createRepository(mode).clear();
          load(mode);
          return true;
        } catch (error) {
          dispatch({ type: 'SAVE_FAILED', error: messageOf(error) });
          return false;
        }
      },

      dismissSaveError: () => dispatch({ type: 'SAVE_ERROR_DISMISSED' }),

      signIn: (email, password) => authenticate(() => accounts.signIn(email, password)),
      register: (email, password) => authenticate(() => accounts.register(email, password)),
      signOut: () => {
        accounts.signOut();
        loadRef.current?.abort();
        dispatch({ type: 'SIGNED_OUT', mode: 'api', reason: null });
      },
    };
  }, [load]);

  return (
    <KairosContext.Provider value={{ state, actions }}>
      {children}
    </KairosContext.Provider>
  );
}

export function useKairos(): KairosContextType {
  const ctx = useContext(KairosContext);
  if (!ctx) throw new Error('useKairos must be used within KairosProvider');
  return ctx;
}

export const MODE_LABELS: Record<DataMode, { short: string; label: string; description: string }> = {
  demo: {
    short: 'Demo',
    label: 'Demo data',
    description: 'A bundled sample athlete. Nothing here is a real measurement.',
  },
  local: {
    short: 'Local',
    label: 'Saved on this device',
    description: 'Records stored in this browser only, without an account. They are not backed up or synced.',
  },
  api: {
    short: 'Account',
    label: 'Kairos account',
    description: 'Your records, stored in your Kairos account on the server.',
  },
};
