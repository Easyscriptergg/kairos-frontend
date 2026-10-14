import React, { useState } from 'react';
import { useKairos } from '../../data/store/KairosStore';
import {
  Card, MetricCard, StatusBadge, Tabs, PageHeader, FilterChips, Field, EmptyState,
} from '../../components/shared/SharedComponents';
import { exerciseLibrary } from '../../data/exercises';
import { WorkoutType } from '../../data/models/types';
import { LoggedSetInput } from '../../data/domain/records';
import { DEFAULT_WEEKLY_SESSIONS } from '../../data/domain/derive';
import { relativeDay, todayKey, windowKeys } from '../../data/domain/dates';
import { setsVolume, trainingLoadFromVolume } from '../../data/domain/scoring';
import { formatWeight, toKilograms, weightUnit } from '../../data/domain/units';
import {
  Dumbbell, Flame, Clock, Plus, Check, Search, Calendar, Target, X, Trash2,
} from 'lucide-react';
import './Train.css';

type TrainTab = 'workouts' | 'exercises' | 'logger';

const MUSCLE_FILTERS = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core'].map(id => ({
  id,
  label: id.charAt(0).toUpperCase() + id.slice(1),
}));

const HISTORY_PAGE_SIZE = 6;
const SESSION_TYPES: WorkoutType[] = ['strength', 'hypertrophy', 'power', 'endurance', 'deload', 'cardio', 'sport-specific'];

export default function Train() {
  const { state, actions } = useKairos();
  const { workouts, athleteState, profile, settings } = state;
  const [selectedTab, setSelectedTab] = useState<TrainTab>('workouts');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('all');
  const [visibleSessions, setVisibleSessions] = useState(HISTORY_PAGE_SIZE);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await actions.deleteWorkout(id);
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  // Logger state for a new session
  const [workoutTitle, setWorkoutTitle] = useState('');
  const [sessionDate, setSessionDate] = useState(todayKey());
  const [sessionType, setSessionType] = useState<WorkoutType>('strength');
  const [duration, setDuration] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState(exerciseLibrary[0].id);
  const [setWeight, setSetWeight] = useState('');
  const [setReps, setSetReps] = useState('');
  const [setRpe, setSetRpe] = useState('');
  const [liveSets, setLiveSets] = useState<(LoggedSetInput & { key: number })[]>([]);
  const [saving, setSaving] = useState(false);

  const unit = weightUnit(settings.unitSystem);
  const anchor = athleteState?.asOf ?? todayKey();
  const sessionsThisWeek = workouts.filter(w => windowKeys(anchor, 7).includes(w.date)).length;
  const sessionTarget = profile?.trainingFrequency || DEFAULT_WEEKLY_SESSIONS;

  const filteredExercises = exerciseLibrary.filter(ex => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = ex.name.toLowerCase().includes(query) ||
      ex.primaryMuscles.some(m => m.toLowerCase().includes(query));
    const matchesMuscle = selectedMuscle === 'all' ||
      (ex.primaryMuscles as string[]).includes(selectedMuscle) ||
      (ex.bodyParts as string[]).includes(selectedMuscle);
    return matchesSearch && matchesMuscle;
  });

  const weight = Number(setWeight);
  const reps = Number(setReps);
  const rpe = setRpe === '' ? undefined : Number(setRpe);
  const canAddSet = setWeight !== '' && weight >= 0 && Number.isInteger(reps) && reps >= 1 && (rpe === undefined || (rpe >= 1 && rpe <= 10));
  const durationMinutes = Number(duration);
  const canFinish = liveSets.length > 0 && durationMinutes > 0 && sessionDate <= todayKey() && !saving;

  const handleAddSet = () => {
    if (!canAddSet) return;
    setLiveSets([...liveSets, {
      key: Date.now(),
      exerciseId: selectedExerciseId,
      weight: toKilograms(weight, settings.unitSystem),
      reps,
      rpe,
    }]);
  };

  const handleFinishWorkout = async () => {
    setSaving(true);
    const saved = await actions.logWorkout({
      name: workoutTitle,
      date: sessionDate,
      durationMinutes,
      type: sessionType,
      sets: liveSets,
    });
    setSaving(false);
    if (!saved) return;
    setLiveSets([]);
    setWorkoutTitle('');
    setDuration('');
    setSelectedTab('workouts');
  };

  return (
    <div className="page train-page">
      <PageHeader
        title="Training"
        subtitle="Sessions, volume and training load"
        actions={
          <button className="btn btn-primary" onClick={() => setSelectedTab('logger')}>
            <Plus size={16} /> Log session
          </button>
        }
      />

      {/* Training status summary */}
      <div className="grid-auto">
        <MetricCard
          label="7-day training load"
          value={athleteState ? athleteState.trainingLoad : '—'}
          icon={<Flame size={18} />}
          source="Volume lifted ÷ 100"
        />
        <MetricCard
          label="Sessions this week"
          value={sessionsThisWeek}
          target={sessionTarget}
          icon={<Target size={18} />}
          color="var(--accent-secondary)"
          source={profile ? 'Against your weekly target' : `Against a default target of ${DEFAULT_WEEKLY_SESSIONS}`}
        />
        <MetricCard
          label="Sessions logged"
          value={workouts.length}
          icon={<Dumbbell size={18} />}
          color="var(--series-sage)"
          source="All time"
        />
        <MetricCard
          label="Training score"
          value={athleteState?.domains.training.score ?? '—'}
          target={100}
          trend={athleteState?.domains.training.score != null ? athleteState.domains.training.trend : undefined}
          icon={<Clock size={18} />}
          color="var(--series-amber)"
          source="Sessions this week ÷ target"
        />
      </div>

      {/* Main Tabs */}
      <Tabs
        tabs={[
          { id: 'workouts', label: 'History', count: workouts.length },
          { id: 'exercises', label: 'Exercise library', count: exerciseLibrary.length },
          { id: 'logger', label: 'Log session' },
        ]}
        activeTab={selectedTab}
        onChange={(tab) => setSelectedTab(tab as TrainTab)}
      />

      {/* TAB 1: WORKOUT HISTORY */}
      {selectedTab === 'workouts' && (
        <div className="animate-fade-in-up">
          {workouts.length === 0 ? (
            <EmptyState
              icon={<Dumbbell size={36} />}
              title="No sessions logged yet"
              description="Log your first session to start tracking volume, training load and estimated strength."
              action={{ label: 'Log a session', onClick: () => setSelectedTab('logger') }}
            />
          ) : (
            <div className="stack">
              {workouts.slice().reverse().slice(0, visibleSessions).map((workout) => (
                <Card key={workout.id} className="workout-card">
                  <div className="workout-card-header">
                    <div className="workout-title-group">
                      <span className="icon-tile">
                        <Dumbbell size={18} />
                      </span>
                      <div>
                        <h3 className="workout-name">{workout.name}</h3>
                        <div className="workout-meta">
                          <span><Calendar size={13} /> {relativeDay(workout.date)}</span>
                          <span><Clock size={13} /> {workout.duration} min</span>
                          <span className="capitalize">{workout.type.replace('-', ' ')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="workout-stats-right">
                      <span className="tag tag-accent">
                        <Flame size={13} /> Load {workout.trainingLoad}
                      </span>
                      {workout.intensity && (
                        <StatusBadge
                          status={`${workout.intensity.replace('-', ' ')} intensity`}
                          variant={workout.intensity === 'very-high' ? 'danger' : workout.intensity === 'high' ? 'warning' : 'neutral'}
                        />
                      )}
                      {!workout.id.startsWith('demo-') && (
                        confirmDeleteId === workout.id ? (
                          <>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(workout.id)} disabled={deletingId === workout.id}>
                              {deletingId === workout.id ? 'Deleting…' : 'Delete session'}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(null)}>Keep</button>
                          </>
                        ) : (
                          <button className="icon-btn" onClick={() => setConfirmDeleteId(workout.id)} aria-label={`Delete ${workout.name}`} title="Delete session">
                            <Trash2 size={15} />
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="workout-exercises-preview">
                    {workout.exercises.map((we) => (
                      <div key={we.id} className="workout-ex-chip">
                        <span className="ex-chip-name">{we.exercise.name}</span>
                        <span className="ex-chip-sets">
                          {we.sets.length} {we.sets.length === 1 ? 'set' : 'sets'}
                          {Math.max(...we.sets.map(s => s.weight)) > 0 && ` · top ${formatWeight(Math.max(...we.sets.map(s => s.weight)), settings.unitSystem)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
              {workouts.length > visibleSessions && (
                <button className="btn btn-secondary history-more" onClick={() => setVisibleSessions(visibleSessions + HISTORY_PAGE_SIZE)}>
                  Show earlier sessions ({workouts.length - visibleSessions} more)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EXERCISE LIBRARY */}
      {selectedTab === 'exercises' && (
        <div className="animate-fade-in-up">
          <div className="library-controls">
            <label className="search-bar">
              <Search size={18} />
              <span className="sr-only">Search exercises</span>
              <input
                type="text"
                placeholder="Search exercise or muscle group…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
            <FilterChips options={MUSCLE_FILTERS} value={selectedMuscle} onChange={setSelectedMuscle} label="Filter by body part" />
          </div>

          {filteredExercises.length === 0 ? (
            <EmptyState icon={<Search size={36} />} title="No exercises match" description="Try a different name or body part." />
          ) : (
            <div className="exercises-grid">
              {filteredExercises.map((ex) => (
                <Card key={ex.id} className="exercise-card">
                  <div className="exercise-header">
                    <h3 className="exercise-title">{ex.name}</h3>
                    <span className="tag">{ex.category}</span>
                  </div>
                  <dl className="exercise-details">
                    <div className="detail-row">
                      <dt>Primary</dt>
                      <dd className="capitalize text-accent">{ex.primaryMuscles.join(', ').replace(/-/g, ' ')}</dd>
                    </div>
                    <div className="detail-row">
                      <dt>Pattern</dt>
                      <dd className="capitalize">{ex.movementPattern} ({ex.forceType})</dd>
                    </div>
                    <div className="detail-row">
                      <dt>Equipment</dt>
                      <dd className="capitalize">{ex.equipment.join(', ').replace(/-/g, ' ')}</dd>
                    </div>
                  </dl>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SESSION LOGGER */}
      {selectedTab === 'logger' && (
        <div className="animate-fade-in-up">
          <Card padding="lg" className="logger-card">
            <div className="form-grid">
              <Field label="Session name" className="full-span">
                <input
                  type="text"
                  className="control-input"
                  placeholder="e.g. Upper Body A"
                  value={workoutTitle}
                  onChange={(e) => setWorkoutTitle(e.target.value)}
                />
              </Field>
              <Field label="Date">
                <input type="date" className="control-input" max={todayKey()} value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
              </Field>
              <Field label="Duration (min)">
                <input type="number" min="1" className="control-input" placeholder="60" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </Field>
              <Field label="Type">
                <select className="control-select capitalize" value={sessionType} onChange={(e) => setSessionType(e.target.value as WorkoutType)}>
                  {SESSION_TYPES.map(t => <option key={t} value={t}>{t.replace('-', ' ')}</option>)}
                </select>
              </Field>
            </div>

            <div className="inset set-logger-box">
              <h4 className="box-title">Add a set</h4>
              <div className="set-inputs-row">
                <Field label="Exercise">
                  <select
                    className="control-select"
                    value={selectedExerciseId}
                    onChange={(e) => setSelectedExerciseId(e.target.value)}
                  >
                    {exerciseLibrary.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label={`Weight (${unit})`}>
                  <input type="number" min="0" step="0.5" className="control-input" placeholder="0" value={setWeight} onChange={(e) => setSetWeight(e.target.value)} />
                </Field>
                <Field label="Reps">
                  <input type="number" min="1" step="1" className="control-input" placeholder="8" value={setReps} onChange={(e) => setSetReps(e.target.value)} />
                </Field>
                <Field label="RPE (optional)">
                  <input type="number" min="1" max="10" step="0.5" className="control-input" placeholder="1–10" value={setRpe} onChange={(e) => setSetRpe(e.target.value)} />
                </Field>
                <button className="btn btn-secondary" onClick={handleAddSet} disabled={!canAddSet}>
                  <Plus size={16} /> Add set
                </button>
              </div>
            </div>

            {liveSets.length === 0 ? (
              <p className="logger-hint">No sets added yet. Add at least one set and a duration to save the session.</p>
            ) : (
              <div className="logged-sets">
                <div className="logged-sets-heading">
                  <h4 className="box-title">Sets in this session ({liveSets.length})</h4>
                  <span className="tag tag-accent"><Flame size={13} /> Load {trainingLoadFromVolume(setsVolume(liveSets))}</span>
                </div>
                <div className="table-card">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Exercise</th>
                        <th>Weight</th>
                        <th>Reps</th>
                        <th>RPE</th>
                        <th>Volume</th>
                        <th><span className="sr-only">Remove</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveSets.map((s, idx) => (
                        <tr key={s.key}>
                          <td>{idx + 1}</td>
                          <td>{exerciseLibrary.find(e => e.id === s.exerciseId)?.name || s.exerciseId}</td>
                          <td><strong>{formatWeight(s.weight, settings.unitSystem)}</strong></td>
                          <td>{s.reps}</td>
                          <td>{s.rpe ?? '—'}</td>
                          <td>{formatWeight(s.weight * s.reps, settings.unitSystem)}</td>
                          <td>
                            <button className="icon-btn" onClick={() => setLiveSets(liveSets.filter(x => x.key !== s.key))} aria-label={`Remove set ${idx + 1}`}>
                              <X size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleFinishWorkout} disabled={!canFinish}>
                <Check size={16} /> {saving ? 'Saving…' : 'Save session'}
              </button>
              {sessionDate > todayKey() && <span className="form-error">The date cannot be in the future.</span>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
