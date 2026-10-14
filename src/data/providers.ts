import { Connection } from './models/types';

// ============================================================
// DATA PROVIDER CATALOG
// Wearables and apps Kairos intends to ingest from. None of them
// can be authorized yet — that needs the backend's integration
// service — so every provider is listed as not connected.
// ============================================================

const provider = (id: Connection['provider'], name: string, availableDataTypes: string[]): Connection => ({
  id: `conn-${id}`,
  provider: id,
  name,
  status: 'disconnected',
  icon: name.charAt(0),
  color: '',
  availableDataTypes,
  permissions: [],
});

export const providerCatalog: Connection[] = [
  provider('apple-health', 'Apple Health', ['sleep', 'heart-rate', 'hrv', 'resting-hr', 'steps', 'calories', 'workouts']),
  provider('health-connect', 'Health Connect', ['sleep', 'heart-rate', 'hrv', 'steps', 'workouts']),
  provider('garmin', 'Garmin', ['sleep', 'heart-rate', 'hrv', 'resting-hr', 'activities', 'training-sessions', 'stress']),
  provider('whoop', 'WHOOP', ['sleep', 'recovery', 'strain', 'hrv', 'resting-hr']),
  provider('strava', 'Strava', ['activities', 'distance', 'pace', 'heart-rate', 'elevation']),
  provider('oura', 'Oura Ring', ['sleep', 'readiness', 'hrv', 'heart-rate', 'temperature']),
  provider('fitbit', 'Fitbit', ['sleep', 'heart-rate', 'steps', 'calories', 'activities']),
  provider('polar', 'Polar', ['heart-rate', 'training-sessions', 'recovery', 'sleep']),
  provider('coros', 'COROS', ['activities', 'heart-rate', 'sleep', 'training-load']),
];
