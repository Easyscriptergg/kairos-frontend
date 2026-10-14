import React, { useState } from 'react';
import { useKairos, MODE_LABELS } from '../../data/store/KairosStore';
import { Card, SectionHeader, PageHeader } from '../../components/shared/SharedComponents';
import { DataMode, RecommendationSensitivity, UnitSystem } from '../../data/models/types';
import { READY_THRESHOLDS } from '../../data/domain/derive';
import { API_BASE_URL } from '../../data/api/apiClient';
import { isApiConfigured } from '../../data/api/repository';
import { NavLink } from 'react-router-dom';
import { RotateCcw, Trash2, LogOut, LogIn, UserRound } from 'lucide-react';
import './Settings.css';

const MODES: DataMode[] = ['demo', 'local', 'api'];
const UNITS: { id: UnitSystem; label: string }[] = [
  { id: 'metric', label: 'Metric (kg)' },
  { id: 'imperial', label: 'Imperial (lb)' },
];
const SENSITIVITIES: RecommendationSensitivity[] = ['conservative', 'balanced', 'aggressive'];

const SENSITIVITY_COPY: Record<RecommendationSensitivity, string> = {
  conservative: 'Recommends a full session only when recovery is clearly high.',
  balanced: 'The default trade-off between pushing and backing off.',
  aggressive: 'Recommends a full session at a lower recovery score.',
};

export default function Settings() {
  const { state, actions } = useKairos();
  const { mode, settings } = state;
  const [confirmingClear, setConfirmingClear] = useState(false);
  const loggedCount = state.workouts.length + state.recovery.length + state.nutrition.length;

  const handleClear = async () => {
    await actions.clearStoredRecords();
    setConfirmingClear(false);
  };

  return (
    <div className="page settings-page">
      <PageHeader title="Settings" subtitle="Where your data lives, display units and how recommendations behave" />

      <div className="stack">
        {/* Data source */}
        <Card padding="lg">
          <SectionHeader
            title="Data source"
            subtitle="Each source keeps its own records. Switching never copies or overwrites anything."
          />
          <div className="segmented" role="group" aria-label="Data source">
            {MODES.map(m => (
              <button
                key={m}
                className={mode === m ? 'active' : ''}
                aria-pressed={mode === m}
                disabled={m === 'api' && !isApiConfigured}
                onClick={() => { setConfirmingClear(false); actions.setMode(m); }}
              >
                {MODE_LABELS[m].label}
              </button>
            ))}
          </div>
          <p className="setting-hint">
            <strong>{MODE_LABELS[mode].label}.</strong> {MODE_LABELS[mode].description}
          </p>
          <p className="setting-note">
            {isApiConfigured
              ? <>Kairos API configured at <code>{API_BASE_URL}</code>.</>
              : <>No Kairos API is configured. Set <code>VITE_API_BASE_URL</code> and rebuild to enable it — see <code>docs/API_CONTRACT.md</code>.</>}
          </p>
        </Card>

        {/* Account */}
        {mode === 'api' && (
          <Card padding="lg">
            <SectionHeader
              title="Account"
              subtitle={state.account ? 'Your records are stored in this Kairos account.' : 'You are signed out. Sign in to see and log your records.'}
            />
            {state.account ? (
              <div className="form-actions">
                <span className="tag"><UserRound size={13} /> {state.account.email}</span>
                <button className="btn btn-secondary" onClick={actions.signOut}>
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            ) : (
              <div className="form-actions">
                <NavLink to="/" className="btn btn-primary"><LogIn size={15} /> Sign in or create an account</NavLink>
              </div>
            )}
          </Card>
        )}

        {/* Units */}
        <Card padding="lg">
          <SectionHeader title="Units" subtitle="How weights are shown and entered. Records are always stored in kilograms." />
          <div className="segmented" role="group" aria-label="Units">
            {UNITS.map(u => (
              <button
                key={u.id}
                className={settings.unitSystem === u.id ? 'active' : ''}
                aria-pressed={settings.unitSystem === u.id}
                onClick={() => actions.updateSettings({ unitSystem: u.id })}
              >
                {u.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Recommendation sensitivity */}
        <Card padding="lg">
          <SectionHeader
            title="Recommendation sensitivity"
            subtitle="Sets the recovery score at which Kairos calls you ready for a full session"
          />
          <div className="segmented" role="group" aria-label="Recommendation sensitivity">
            {SENSITIVITIES.map(level => (
              <button
                key={level}
                className={settings.sensitivity === level ? 'active' : ''}
                aria-pressed={settings.sensitivity === level}
                onClick={() => actions.updateSettings({ sensitivity: level })}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
          <p className="setting-hint">
            <strong>Ready at a recovery score of {READY_THRESHOLDS[settings.sensitivity]} or above.</strong> {SENSITIVITY_COPY[settings.sensitivity]}
          </p>
        </Card>

        {/* Stored records */}
        {mode !== 'api' && (
          <Card padding="lg" className="danger-zone">
            <SectionHeader
              title={mode === 'demo' ? 'Reset demo' : 'Delete my records'}
              subtitle={mode === 'demo'
                ? 'Removes anything you logged while exploring the demo. The sample athlete itself is rebuilt on every load and never changes.'
                : `Permanently deletes your profile and all ${loggedCount} records saved in this browser. There is no backup.`}
            />
            <div className="form-actions">
              {confirmingClear ? (
                <>
                  <button className="btn btn-danger" onClick={handleClear}>
                    <Trash2 size={15} /> Yes, delete everything
                  </button>
                  <button className="btn btn-ghost" onClick={() => setConfirmingClear(false)}>Cancel</button>
                </>
              ) : mode === 'demo' ? (
                <button className="btn btn-secondary" onClick={handleClear}>
                  <RotateCcw size={15} /> Reset demo
                </button>
              ) : (
                <button className="btn btn-danger" onClick={() => setConfirmingClear(true)}>
                  <Trash2 size={15} /> Delete my records
                </button>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
