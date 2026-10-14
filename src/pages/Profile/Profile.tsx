import React, { useState } from 'react';
import { useKairos } from '../../data/store/KairosStore';
import { Card, SectionHeader, StatusBadge, PageHeader, Field } from '../../components/shared/SharedComponents';
import { AthleteProfile, ExperienceLevel, PerformanceLevel, Sport } from '../../data/models/types';
import { newId } from '../../data/domain/records';
import { todayKey } from '../../data/domain/dates';
import { convertWeight, toKilograms, weightUnit } from '../../data/domain/units';
import { Dumbbell, Target, Pencil, Check } from 'lucide-react';
import './Profile.css';

const SPORTS: Sport[] = ['strength', 'running', 'cycling', 'team-sport', 'combat', 'hybrid'];
const EXPERIENCE: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced', 'elite'];
const LEVELS: PerformanceLevel[] = ['recreational', 'competitive', 'semi-pro', 'professional'];
const EQUIPMENT = ['barbell', 'dumbbells', 'cable-machine', 'machine', 'bench', 'squat-rack', 'pull-up-bar', 'kettlebell', 'bands'];

const titleCase = (value: string) => value.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const optionalNumber = (value: string) => (value === '' ? undefined : Number(value));

export default function Profile() {
  const { state, actions } = useKairos();
  const { profile, settings } = state;
  const unit = weightUnit(settings.unitSystem);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => toForm(profile, settings.unitSystem));
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm({ ...form, [key]: value });

  const startEditing = () => {
    setForm(toForm(profile, settings.unitSystem));
    setEditing(true);
  };

  const frequency = Number(form.trainingFrequency);
  const formValid = form.name.trim() !== '' && form.discipline.trim() !== '' && Number.isInteger(frequency) && frequency >= 1 && frequency <= 14;

  const handleSave = async () => {
    setSaving(true);
    const weight = optionalNumber(form.weight);
    const saved = await actions.saveProfile({
      id: profile?.id ?? newId('athlete'),
      name: form.name.trim(),
      sport: form.sport,
      discipline: form.discipline.trim(),
      experience: form.experience,
      goal: form.goal.trim(),
      trainingFrequency: frequency,
      equipment: form.equipment,
      performanceLevel: form.performanceLevel,
      bodyMetrics: {
        height: optionalNumber(form.height),
        weight: weight === undefined ? undefined : toKilograms(weight, settings.unitSystem),
        age: optionalNumber(form.age),
      },
      createdAt: profile?.createdAt || todayKey(),
      onboardingComplete: true,
    });
    setSaving(false);
    if (saved) setEditing(false);
  };

  if (editing || !profile) {
    return (
      <div className="page profile-page">
        <PageHeader
          title={profile ? 'Edit profile' : 'Create your profile'}
          subtitle={profile ? 'Changes apply to targets and calculations straight away' : 'Kairos uses your weekly session target to score training consistency'}
        />
        <Card padding="lg">
          <div className="form-grid">
            <Field label="Name">
              <input type="text" className="control-input" value={form.name} onChange={e => set('name', e.target.value)} />
            </Field>
            <Field label="Discipline">
              <input type="text" className="control-input" placeholder="e.g. Powerbuilding" value={form.discipline} onChange={e => set('discipline', e.target.value)} />
            </Field>
            <Field label="Sport">
              <select className="control-select" value={form.sport} onChange={e => set('sport', e.target.value as Sport)}>
                {SPORTS.map(s => <option key={s} value={s}>{titleCase(s)}</option>)}
              </select>
            </Field>
            <Field label="Experience">
              <select className="control-select" value={form.experience} onChange={e => set('experience', e.target.value as ExperienceLevel)}>
                {EXPERIENCE.map(s => <option key={s} value={s}>{titleCase(s)}</option>)}
              </select>
            </Field>
            <Field label="Level">
              <select className="control-select" value={form.performanceLevel} onChange={e => set('performanceLevel', e.target.value as PerformanceLevel)}>
                {LEVELS.map(s => <option key={s} value={s}>{titleCase(s)}</option>)}
              </select>
            </Field>
            <Field label="Sessions per week" hint="Your weekly target">
              <input type="number" min="1" max="14" className="control-input" value={form.trainingFrequency} onChange={e => set('trainingFrequency', e.target.value)} />
            </Field>
            <Field label="Height (cm)" hint="Optional">
              <input type="number" min="0" className="control-input" value={form.height} onChange={e => set('height', e.target.value)} />
            </Field>
            <Field label={`Weight (${unit})`} hint="Optional">
              <input type="number" min="0" step="0.1" className="control-input" value={form.weight} onChange={e => set('weight', e.target.value)} />
            </Field>
            <Field label="Age" hint="Optional">
              <input type="number" min="0" className="control-input" value={form.age} onChange={e => set('age', e.target.value)} />
            </Field>
            <Field label="Primary goal" className="full-span">
              <input type="text" className="control-input" placeholder="What are you training for?" value={form.goal} onChange={e => set('goal', e.target.value)} />
            </Field>
          </div>

          <div className="field">
            <span className="field-label">Available equipment</span>
            <div className="chip-row">
              {EQUIPMENT.map(eq => {
                const selected = form.equipment.includes(eq);
                return (
                  <button
                    key={eq}
                    className={`chip ${selected ? 'active' : ''}`}
                    aria-pressed={selected}
                    onClick={() => set('equipment', selected ? form.equipment.filter(x => x !== eq) : [...form.equipment, eq])}
                  >
                    {titleCase(eq)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={!formValid || saving}>
              <Check size={16} /> {saving ? 'Saving…' : 'Save profile'}
            </button>
            {profile && <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
            {!formValid && <span className="field-hint">Name, discipline and a weekly session target are required.</span>}
          </div>
        </Card>
      </div>
    );
  }

  const metrics = profile.bodyMetrics;
  const biometrics = [
    { label: 'Height', value: metrics?.height !== undefined ? `${metrics.height} cm` : null },
    { label: 'Weight', value: metrics?.weight !== undefined ? `${convertWeight(metrics.weight, settings.unitSystem)} ${unit}` : null },
    { label: 'Age', value: metrics?.age !== undefined ? `${metrics.age} yrs` : null },
    { label: 'Weekly target', value: `${profile.trainingFrequency} sessions` },
  ];

  return (
    <div className="page profile-page">
      <PageHeader
        title="Profile"
        subtitle="Who you are as an athlete and what you train with"
        actions={
          <button className="btn btn-secondary" onClick={startEditing}>
            <Pencil size={15} /> Edit profile
          </button>
        }
      />

      <div className="profile-grid">
        {/* Identity */}
        <Card padding="lg" className="profile-id-card">
          <div className="profile-avatar" aria-hidden="true">{profile.name.charAt(0).toUpperCase()}</div>
          <div>
            <h2 className="profile-name">{profile.name}</h2>
            <div className="profile-badges">
              <StatusBadge status={profile.discipline} variant="info" />
              <StatusBadge status={titleCase(profile.performanceLevel)} variant="neutral" />
              <StatusBadge status={titleCase(profile.experience)} variant="neutral" />
            </div>
          </div>
          <div className="inset profile-goal-box">
            <span className="goal-label"><Target size={14} /> Primary goal</span>
            <p className="goal-text">{profile.goal || 'No goal set yet.'}</p>
          </div>
        </Card>

        {/* Body metrics */}
        <Card padding="lg">
          <SectionHeader title="Body metrics" subtitle="Used for relative-strength calculations" />
          <div className="biometrics-grid">
            {biometrics.map(item => (
              <div className="inset bio-item" key={item.label}>
                <span className="bio-label">{item.label}</span>
                <span className={`bio-value ${item.value === null ? 'unset' : ''}`}>{item.value ?? 'Not set'}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Equipment */}
        <Card padding="lg" className="full-span">
          <SectionHeader title="Available equipment" subtitle="What you have access to when you train" />
          {profile.equipment.length === 0 ? (
            <p className="field-hint">No equipment selected.</p>
          ) : (
            <div className="equipment-chips">
              {profile.equipment.map(eq => (
                <span key={eq} className="tag">
                  <Dumbbell size={13} />
                  {titleCase(eq)}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function toForm(profile: AthleteProfile | null, unitSystem: 'metric' | 'imperial') {
  const text = (n: number | undefined) => (n === undefined ? '' : String(n));
  return {
    name: profile?.name ?? '',
    sport: profile?.sport ?? ('strength' as Sport),
    discipline: profile?.discipline ?? '',
    experience: profile?.experience ?? ('intermediate' as ExperienceLevel),
    performanceLevel: profile?.performanceLevel ?? ('recreational' as PerformanceLevel),
    goal: profile?.goal ?? '',
    trainingFrequency: text(profile?.trainingFrequency) || '3',
    height: text(profile?.bodyMetrics?.height),
    weight: profile?.bodyMetrics?.weight === undefined ? '' : String(convertWeight(profile.bodyMetrics.weight, unitSystem)),
    age: text(profile?.bodyMetrics?.age),
    equipment: profile?.equipment ?? [],
  };
}
