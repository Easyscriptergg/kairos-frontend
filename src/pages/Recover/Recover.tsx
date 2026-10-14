import React, { useState } from 'react';
import { useKairos } from '../../data/store/KairosStore';
import {
  Card, SectionHeader, MetricCard, ScoreRing, StatusBadge, PageHeader, Field, EmptyState,
} from '../../components/shared/SharedComponents';
import { RecoveryEntry, TrendDirection } from '../../data/models/types';
import { relativeDay, shortDate, todayKey } from '../../data/domain/dates';
import { mean, recoveryBand } from '../../data/domain/scoring';
import {
  Moon, Heart, Activity, ShieldAlert, Plus, Check, Info,
} from 'lucide-react';
import './Recover.css';

const BAND_COPY = {
  high: { label: 'High recovery', variant: 'success', heading: 'Well recovered', color: 'var(--color-success)' },
  moderate: { label: 'Moderate recovery', variant: 'warning', heading: 'Partly recovered', color: 'var(--series-amber)' },
  low: { label: 'Low recovery', variant: 'danger', heading: 'Under-recovered', color: 'var(--color-danger)' },
} as const;

const SOURCE_LABELS: Record<string, string> = { demo: 'Demo data', manual: 'Manual check-in' };
const sourceLabel = (entry: RecoveryEntry) => SOURCE_LABELS[entry.source.provider] ?? entry.source.provider;

/** Direction of the latest value against the mean of up to seven earlier check-ins. */
function trendAgainstHistory(history: RecoveryEntry[], pick: (r: RecoveryEntry) => number | undefined, higherIsBetter: boolean): TrendDirection | undefined {
  const latest = pick(history[history.length - 1]);
  const baseline = mean(history.slice(-8, -1).map(pick).filter((v): v is number => v !== undefined));
  if (latest === undefined || baseline === null) return undefined;
  const change = (latest - baseline) / baseline;
  if (Math.abs(change) < 0.03) return 'stable';
  return (change > 0) === higherIsBetter ? 'improving' : 'declining';
}

export default function Recover() {
  const { state, actions } = useKairos();
  const { recovery } = state;
  const latest: RecoveryEntry | undefined = recovery[recovery.length - 1];

  // Check-in form
  const [showLogModal, setShowLogModal] = useState(false);
  const [date, setDate] = useState(todayKey());
  const [sleepHours, setSleepHours] = useState('');
  const [sleepQuality, setSleepQuality] = useState('');
  const [restingHr, setRestingHr] = useState('');
  const [hrvVal, setHrvVal] = useState('');
  const [soreness, setSoreness] = useState('');
  const [saving, setSaving] = useState(false);

  const input = {
    sleepDuration: Number(sleepHours),
    sleepQuality: Number(sleepQuality),
    restingHR: Number(restingHr),
    soreness: Number(soreness),
  };
  const hrv = hrvVal === '' ? undefined : Number(hrvVal);
  const formValid = sleepHours !== '' && input.sleepDuration > 0 && input.sleepDuration <= 24
    && sleepQuality !== '' && input.sleepQuality >= 0 && input.sleepQuality <= 100
    && restingHr !== '' && input.restingHR >= 25 && input.restingHR <= 150
    && soreness !== '' && input.soreness >= 1 && input.soreness <= 10
    && (hrv === undefined || (hrv > 0 && hrv <= 300))
    && date <= todayKey();
  const replacesExisting = recovery.some(r => r.date === date);

  const handleSaveRecovery = async () => {
    setSaving(true);
    const saved = await actions.logRecovery({ date, ...input, hrv });
    setSaving(false);
    if (saved) setShowLogModal(false);
  };

  const band = latest ? BAND_COPY[recoveryBand(latest.recoveryScore)] : null;

  return (
    <div className="page recover-page">
      <PageHeader
        title="Recovery"
        subtitle="Sleep, heart-rate variability and how recovered you are"
        actions={
          <button className="btn btn-primary" onClick={() => setShowLogModal(!showLogModal)}>
            <Plus size={16} /> Log check-in
          </button>
        }
      />

      {/* Check-in form */}
      {showLogModal && (
        <Card padding="lg" className="drawer animate-fade-in-up">
          <SectionHeader
            title="Morning recovery check-in"
            subtitle="One check-in per day. The recovery score is calculated from sleep duration, HRV and resting heart rate."
          />
          <div className="form-grid">
            <Field label="Date">
              <input type="date" className="control-input" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Sleep (hours)">
              <input type="number" step="0.1" min="0" max="24" className="control-input" placeholder="7.5" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} />
            </Field>
            <Field label="Sleep quality (0–100)">
              <input type="number" min="0" max="100" className="control-input" placeholder="80" value={sleepQuality} onChange={(e) => setSleepQuality(e.target.value)} />
            </Field>
            <Field label="Resting HR (bpm)">
              <input type="number" min="25" max="150" className="control-input" placeholder="58" value={restingHr} onChange={(e) => setRestingHr(e.target.value)} />
            </Field>
            <Field label="HRV rMSSD (ms)" hint="Optional">
              <input type="number" min="1" max="300" className="control-input" placeholder="—" value={hrvVal} onChange={(e) => setHrvVal(e.target.value)} />
            </Field>
            <Field label="Soreness (1–10)" hint="1 = fresh, 10 = severe">
              <input type="number" min="1" max="10" className="control-input" placeholder="3" value={soreness} onChange={(e) => setSoreness(e.target.value)} />
            </Field>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleSaveRecovery} disabled={!formValid || saving}>
              <Check size={16} /> {saving ? 'Saving…' : replacesExisting ? 'Replace check-in' : 'Save check-in'}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowLogModal(false)}>
              Cancel
            </button>
            {replacesExisting && <span className="field-hint">A check-in already exists for {shortDate(date)}; saving replaces it.</span>}
          </div>
        </Card>
      )}

      {!latest || !band ? (
        <EmptyState
          icon={<Moon size={36} />}
          title="No recovery check-ins yet"
          description="Log this morning’s sleep and heart-rate numbers to get a recovery score. Wearable import is not available yet."
          action={showLogModal ? undefined : { label: 'Log a check-in', onClick: () => setShowLogModal(true) }}
        />
      ) : (
        <>
          {/* Latest recovery state */}
          <Card padding="lg" className="recover-score-card">
            <div className="recover-score-header">
              <span className="kicker">Latest check-in · {relativeDay(latest.date)}</span>
              <StatusBadge status={band.label} variant={band.variant} />
            </div>
            <div className="recover-score-content">
              <ScoreRing
                score={latest.recoveryScore}
                label="Recovery score"
                sublabel="of 100"
                size="lg"
                color={band.color}
              />
              <div className="recover-narrative">
                <h2 className="narrative-heading">{band.heading}</h2>
                <p className="narrative-body">
                  You slept {latest.sleepDuration.toFixed(1)} hours with a resting heart rate of {latest.restingHR} bpm
                  {latest.hrv !== undefined ? ` and an HRV of ${latest.hrv} ms` : '; no HRV reading was logged'}.
                  Fatigue is rated {latest.fatigue.replace('-', ' ')}.
                </p>
                <p className="recover-method">
                  <Info size={14} />
                  An internal Kairos score — 35% sleep duration, 40% HRV, 25% resting heart rate. It is not a medical measure.
                </p>
              </div>
            </div>
          </Card>

          {/* Key metric tiles */}
          <div className="grid-auto">
            <MetricCard
              label="Sleep duration"
              value={latest.sleepDuration.toFixed(1)}
              unit="h"
              trend={trendAgainstHistory(recovery, r => r.sleepDuration, true)}
              icon={<Moon size={18} />}
              color="var(--accent-secondary)"
              source={sourceLabel(latest)}
            />
            <MetricCard
              label="Heart-rate variability"
              value={latest.hrv ?? '—'}
              unit={latest.hrv !== undefined ? 'ms' : undefined}
              trend={trendAgainstHistory(recovery, r => r.hrv, true)}
              icon={<Activity size={18} />}
              color="var(--series-sage)"
              source={latest.hrv !== undefined ? sourceLabel(latest) : 'Not logged'}
            />
            <MetricCard
              label="Resting heart rate"
              value={latest.restingHR}
              unit="bpm"
              trend={trendAgainstHistory(recovery, r => r.restingHR, false)}
              icon={<Heart size={18} />}
              source={sourceLabel(latest)}
            />
            <MetricCard
              label="Soreness"
              value={latest.soreness}
              target={10}
              trend={trendAgainstHistory(recovery, r => r.soreness, false)}
              icon={<ShieldAlert size={18} />}
              color="var(--series-amber)"
              source="Self-reported"
            />
          </div>

          {/* Check-in history */}
          <section>
            <SectionHeader
              title="Check-in history"
              subtitle={`Most recent ${Math.min(14, recovery.length)} of ${recovery.length} check-ins. Trend arrows above compare the latest value with the seven before it.`}
            />
            <div className="table-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Recovery</th>
                    <th>Sleep</th>
                    <th>Quality</th>
                    <th>Resting HR</th>
                    <th>HRV</th>
                    <th>Fatigue</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {recovery.slice(-14).reverse().map((entry) => (
                    <tr key={entry.id}>
                      <td>{relativeDay(entry.date)}</td>
                      <td>
                        <span className={`score-badge ${recoveryBand(entry.recoveryScore)}`}>
                          {entry.recoveryScore}
                        </span>
                      </td>
                      <td>{entry.sleepDuration.toFixed(1)} h</td>
                      <td>{entry.sleepQuality}</td>
                      <td>{entry.restingHR} bpm</td>
                      <td>{entry.hrv !== undefined ? `${entry.hrv} ms` : '—'}</td>
                      <td className="capitalize">{entry.fatigue.replace('-', ' ')}</td>
                      <td>{sourceLabel(entry)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
