# Kairos frontend ↔ backend API contract

**Status: implemented.** The backend is the Spring Boot service in the separate `kairos-backend` repository. Every endpoint below is covered by its integration tests against PostgreSQL, and the frontend has been exercised end-to-end against it locally. It is not deployed yet; see [DEPLOYMENT.md](DEPLOYMENT.md).

| Piece | Where |
|---|---|
| Backend DTOs and validation | `kairos-backend/src/main/java/com/kairos/backend/**/*Dto.java` |
| Frontend wire types and parsers | `src/data/api/contract.ts` |
| Frontend client (base URL, token, errors) | `src/data/api/apiClient.ts`, `auth.ts`, `session.ts` |
| Calculations (scores, loads, insights) | `src/data/domain/` (frontend only) |

## Conventions

- **Base URL:** `VITE_API_BASE_URL` includes the `/api` prefix, e.g. `https://kairos-backend.onrender.com/api`. Paths below are appended to it.
- **Format:** JSON request and response bodies.
- **Dates:** the athlete's local calendar day, `YYYY-MM-DD`, stored without time-zone conversion. Timestamps are ISO 8601.
- **Units:** kilograms, minutes, hours of sleep, litres of water. The unit preference only changes display.
- **Authentication:** `Authorization: Bearer <token>` on every endpoint except health and the two auth endpoints. Tokens are HS256 JWTs, valid 12 hours, with no refresh token. A `401` signs the athlete out in the app.
- **Errors:** RFC 7807 problem documents (`application/problem+json`) with `detail` and, for validation, an `errors` list of `{field, message}`. The app shows `detail` and never substitutes sample data for a failed request.
- **Optional fields** are omitted rather than sent as `null`, except `hydrationLiters`, which is always present and `null` when not logged.
- **Observations only:** the server stores observations. Recovery score, fatigue, training load, intensity, day totals, estimated 1RMs, PRs, the athlete-state scores and insights are calculated by the frontend from these records.

## Endpoints

| Method | Path | Success | Failure |
|---|---|---|---|
| GET | `/health` *(no `/api` prefix)* | `200 {"status":"UP","database":"UP"}` | `503` |
| POST | `/v1/auth/register` `{email, password}` | `201 {token, expiresAt, user:{id,email}}` | `400` invalid, `409` email taken |
| POST | `/v1/auth/login` `{email, password}` | `200` same shape | `401` (one message for any wrong combination) |
| GET | `/v1/auth/me` | `200 {id, email}` | `401` |
| GET | `/v1/profile` | `200` profile | `404` until saved |
| PUT | `/v1/profile` | `200` profile | `400` |
| GET | `/v1/training-sessions?from=&to=` | `200` session[] (oldest first) | `400` bad range |
| POST | `/v1/training-sessions` | `201` created, or `200` with the stored session if the client `id` already exists | `400` (unknown exercise id, future date, validation) |
| DELETE | `/v1/training-sessions/{id}` | `204` | `404` (missing or another athlete's) |
| GET | `/v1/recovery-records?from=&to=` | `200` record[] | |
| PUT | `/v1/recovery-records/{date}` | `200` (creates or replaces that day) | `400` (path/body date mismatch, ranges, provider not `manual`) |
| DELETE | `/v1/recovery-records/{date}` | `204` | `404` |
| GET | `/v1/nutrition-days?from=&to=` | `200` day[] | |
| PUT | `/v1/nutrition-days/{date}` | `200` (replaces the whole day, meals included) | `400` |
| DELETE | `/v1/nutrition-days/{date}` | `204` | `404` |

Interactive documentation: `/swagger-ui.html` on the backend. OpenAPI JSON: `/v3/api-docs`.

### Which endpoints the frontend calls

- **Sign-in screen:** `register`, `login`.
- **Every page, on load:** `GET` profile (404 means "no profile yet"), sessions, recovery records and nutrition days.
- **Training:** `POST` to log a session, `DELETE` to delete one.
- **Recovery:** `PUT` to log a check-in.
- **Nutrition:** `PUT` of the whole day to add a meal.
- **Profile:** `PUT`.

The recovery and nutrition `DELETE` endpoints exist but have no UI yet.

## Shapes

```jsonc
// Profile (id and createdAt are set by the server)
{
  "id": "uuid", "name": "Alex", "sport": "strength | running | cycling | team-sport | combat | hybrid",
  "discipline": "Powerlifting", "experience": "beginner | intermediate | advanced | elite",
  "goal": "", "trainingFrequency": 4, "equipment": ["barbell"],
  "performanceLevel": "recreational | competitive | semi-pro | professional",
  "bodyMetrics": { "height": 180, "weight": 90.5, "age": 29 },
  "createdAt": "YYYY-MM-DD", "onboardingComplete": true
}

// Training session: sets belong to the exercise they were performed on
{
  "id": "workout-…", "date": "YYYY-MM-DD", "name": "Upper Body A",
  "type": "strength | hypertrophy | power | endurance | deload | cardio | sport-specific",
  "durationMinutes": 60,
  "exercises": [{ "id": "we-…", "exerciseId": "bench-press",
    "sets": [{ "id": "set-…", "setNumber": 1, "weightKg": 100, "reps": 5, "rpe": 8, "restSeconds": 180, "performedAt": "ISO" }] }]
}

// Recovery record: one per day
{
  "id": "recovery-YYYY-MM-DD", "date": "YYYY-MM-DD", "sleepDurationHours": 7.5, "sleepQuality": 80,
  "restingHeartRate": 58, "hrvMs": 60, "soreness": 3, "mood": 7, "stress": 3,
  "source": { "provider": "manual", "recordedAt": "ISO" }
}

// Nutrition day: one per date
{
  "id": "nutrition-YYYY-MM-DD", "date": "YYYY-MM-DD", "hydrationLiters": null,
  "meals": [{ "id": "meal-…", "name": "Oats", "time": "07:30", "calories": 520, "protein": 40, "carbohydrates": 60, "fat": 12 }],
  "targets": { "calories": 2600, "protein": 165, "carbohydrates": 320, "fat": 75, "hydration": 3.0 }
}
```

`exerciseId` must be one of the 26 ids in `src/data/exercises.ts`. The backend's migration `V2__exercise_catalog.sql` was generated from that file, so the two lists must change together.

## Not built yet

- **Refresh tokens, password reset, email verification and rate limiting** on sign-in.
- **Wearable connections:** OAuth and data ingestion per provider. Each needs developer approval and, for Apple Health, a companion iOS app. Until then the API accepts only `manual` recovery records.
- **AI assistant:** no endpoint and no model. Insights are deterministic comparisons in `src/data/domain/derive.ts`.
- **Calendar scheduling:** the Calendar page lists logged records; there is no planned-session model.
- **Editing nutrition targets**, logging hydration, and editing or deleting recovery and nutrition records from the UI.
