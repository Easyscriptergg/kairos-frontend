# Kairos frontend ↔ backend API contract

**Status: proposed. No backend implements this yet, and nothing in the frontend has been verified against a real server.**

This is the smallest REST surface the frontend needs to stop storing records in the browser. The frontend side is already written (`src/data/api/`); a backend that implements the endpoints below works with it by setting one environment variable.

## What exists today

| Piece | State |
|---|---|
| `backend/` (NestJS 11 + Prisma, PostgreSQL) | Scaffold only. Exposes `GET /` and `GET /health`. Every domain module (`training`, `recovery`, `nutrition`, `athletes`, `auth`, …) is an empty `@Module({})`. The Prisma schema defines the tables, but there are no migrations, controllers, services or `.env`. |
| Spring Boot backend | Not found. The Spring Tools workspace holds `heavy-duty-backend`, `SchedulingExample-1`, `SecurityApp`, `StudentManagementApp` and `UserApplication-1`; none is a Kairos API. `heavy-duty-backend` has `Workout`/`Exercise`/`SetLog` entities but only a `/api/health` endpoint, an in-memory H2 database, and no athlete, recovery or nutrition model. |
| Authentication | Not implemented anywhere. |
| Frontend | Uses demo data or browser storage. Switches to this API when `VITE_API_BASE_URL` is set. |

**Decision needed:** which backend is authoritative — finish the NestJS scaffold, or build the Spring Boot service. The contract below is the same either way.

## Conventions

- Base URL: `VITE_API_BASE_URL`, e.g. `http://localhost:8080/api`. Paths below are appended to it.
- JSON request and response bodies. Dates are local calendar days, `YYYY-MM-DD`. Timestamps are ISO 8601.
- Weights are kilograms, durations minutes, sleep hours, hydration litres.
- CORS must allow the frontend origin (`http://localhost:5173` in development).
- Errors: any non-2xx status. The frontend shows the status and stops; it never substitutes sample data.
- The server stores **observations only**. Recovery score, fatigue, training load, session intensity, day totals, estimated 1RMs, PRs, the athlete-state scores and insights are all calculated in the frontend (`src/data/domain/`) from these records, so they are not part of the contract.

## Endpoints

| Method | Path | Purpose | Success |
|---|---|---|---|
| GET | `/v1/profile` | The signed-in athlete's profile | `200` profile, or `404` if none yet |
| PUT | `/v1/profile` | Create or replace the profile | `200` profile |
| GET | `/v1/training-sessions` | All sessions | `200` session[] |
| POST | `/v1/training-sessions` | Create a session (client supplies the `id`) | `200`/`201` session |
| GET | `/v1/recovery-records` | All recovery records | `200` record[] |
| PUT | `/v1/recovery-records/{date}` | Create or replace the record for a day | `200` record |
| GET | `/v1/nutrition-days` | All nutrition days | `200` day[] |
| PUT | `/v1/nutrition-days/{date}` | Create or replace a day, including its meals | `200` day |

Every write must return the stored record in the same shape. The frontend validates each response and rejects one that is missing a required field.

List endpoints return everything for now. Add `?from=YYYY-MM-DD&to=YYYY-MM-DD` once history is large; the frontend needs the last 30 days for the Overview and all sessions for PR history.

## Shapes

The TypeScript definitions are the source of truth: `src/data/api/contract.ts`.

```jsonc
// Profile
{
  "id": "athlete-…",
  "name": "string",
  "sport": "strength | running | cycling | team-sport | combat | hybrid",
  "discipline": "string",
  "experience": "beginner | intermediate | advanced | elite",
  "goal": "string",
  "trainingFrequency": 4,               // sessions per week, the weekly target
  "equipment": ["barbell"],
  "performanceLevel": "recreational | competitive | semi-pro | professional",
  "bodyMetrics": { "height": 178, "weight": 82, "age": 27 },   // all optional
  "createdAt": "YYYY-MM-DD",
  "onboardingComplete": true
}

// Training session
{
  "id": "workout-…",
  "date": "YYYY-MM-DD",
  "name": "string",
  "type": "strength | hypertrophy | power | endurance | deload | cardio | sport-specific",
  "durationMinutes": 60,
  "exercises": [{
    "id": "we-…",
    "exerciseId": "bench-press",        // must match an id in src/data/exercises.ts
    "sets": [{
      "id": "set-…", "setNumber": 1, "weightKg": 100, "reps": 5,
      "rpe": 8,                         // optional, 1–10
      "restSeconds": 180,               // optional
      "performedAt": "ISO timestamp"
    }]
  }]
}

// Recovery record (one per day)
{
  "id": "recovery-YYYY-MM-DD",
  "date": "YYYY-MM-DD",
  "sleepDurationHours": 7.5,
  "sleepQuality": 80,                   // 0–100
  "restingHeartRate": 58,
  "hrvMs": 60,                          // optional
  "soreness": 3,                        // 1–10
  "mood": 7, "stress": 3,               // optional, 1–10
  "source": { "provider": "manual", "recordedAt": "ISO timestamp" }
}

// Nutrition day (one per day)
{
  "id": "nutrition-YYYY-MM-DD",
  "date": "YYYY-MM-DD",
  "hydrationLiters": 2.5,               // null when not logged
  "meals": [{ "id": "meal-…", "name": "string", "time": "HH:MM", "calories": 520, "protein": 40, "carbohydrates": 60, "fat": 12 }],
  "targets": { "calories": 2600, "protein": 165, "carbohydrates": 320, "fat": 75, "hydration": 3.0 }
}
```

`source.provider` is how provenance is kept: `manual` for check-ins typed by the athlete, and the provider id (`garmin`, `whoop`, `apple-health`, `health-connect`, …) for imported measurements, each with its own `recordedAt`.

## Mapping to the existing Prisma schema

The NestJS schema already has matching tables, so no new tables are needed if that backend is chosen:

| Contract | Prisma model(s) |
|---|---|
| Profile | `AthleteProfile` (+ `User`) |
| Training session, exercises, sets | `TrainingSession`, `TrainingExercise`, `TrainingSet` |
| Recovery record | `RecoveryRecord`, `SleepRecord`, `HeartRateRecord`, `HRVRecord` |
| Nutrition day and meals | `NutritionDay`, `Meal` |
| `source` | `DataSource` |

## Not covered yet

- **Authentication.** The frontend sends no credentials. When auth is added (the NestJS scaffold already depends on JWT and Passport), the client needs a token attached in `src/data/api/apiClient.ts` and a sign-in screen. Tokens must not be stored in `VITE_` variables.
- **Wearable connections.** Needs OAuth and ingestion on the backend (`IntegrationConnection`, `RawDataEvent`, `SyncJob` in the Prisma schema). The Connections page lists providers as not connected until this exists.
- **Editing and deleting records.** The frontend only creates records and replaces a day's recovery or nutrition. `PATCH`/`DELETE` endpoints are not needed yet.
- **Nutrition targets.** Each day carries its targets; there is no endpoint or screen for changing them.
- **The assistant** ("Ask Kairos") has no endpoint and no model behind it.

## Trying it

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:8080/api
npm run dev
```

The app starts in "Kairos API" mode. If the server is unreachable or answers with an unexpected shape, every page shows a load error with a retry button; Settings stays reachable so the data source can be switched back.
