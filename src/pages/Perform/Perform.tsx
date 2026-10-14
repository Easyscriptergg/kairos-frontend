import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useKairos } from '../../data/store/KairosStore';
import {
  Card, SectionHeader, MetricCard, PageHeader, EmptyState,
} from '../../components/shared/SharedComponents';
import { exerciseLibrary } from '../../data/exercises';
import { PR } from '../../data/models/types';
import { relativeDay } from '../../data/domain/dates';
import { convertWeight, formatWeight, weightUnit } from '../../data/domain/units';
import {
  Trophy, Award, Zap, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import './Perform.css';

const BIG_THREE = [
  { id: 'bench-press', label: 'Bench press' },
  { id: 'barbell-squat', label: 'Squat' },
  { id: 'deadlift', label: 'Deadlift' },
];

const exerciseName = (id: string) => exerciseLibrary.find(e => e.id === id)?.name ?? id;

export default function Perform() {
  const { state } = useKairos();
  const navigate = useNavigate();
  const { performance, settings } = state;
  const unit = weightUnit(settings.unitSystem);

  // Latest and first estimate for every lift, plus every PR, across the weekly snapshots
  const lifts = new Map<string, { first: number; latest: number; date: string }>();
  const prs: PR[] = [];
  for (const entry of performance) {
    if (entry.metrics.type !== 'strength') continue;
    for (const [id, value] of Object.entries(entry.metrics.estimated1RMs)) {
      lifts.set(id, { first: lifts.get(id)?.first ?? value, latest: value, date: entry.date });
    }
    prs.push(...entry.metrics.prs);
  }
  prs.sort((a, b) => b.date.localeCompare(a.date));

  const liftRows = [...lifts.entries()]
    .map(([id, lift]) => ({ id, ...lift, changePct: Math.round(((lift.latest - lift.first) / lift.first) * 1000) / 10 }))
    .sort((a, b) => b.latest - a.latest);

  const bigThree = BIG_THREE.map(l => ({ ...l, value: lifts.get(l.id)?.latest }));
  const total = bigThree.every(l => l.value !== undefined) ? bigThree.reduce((s, l) => s + l.value!, 0) : null;

  if (liftRows.length === 0) {
    return (
      <div className="page perform-page">
        <PageHeader title="Performance" subtitle="Estimated strength and personal records from your logged sessions" />
        <EmptyState
          icon={<Trophy size={36} />}
          title="No strength estimates yet"
          description="Estimates appear once you log sets of 1–12 reps with weight. Sets logged below RPE 7 are not used."
          action={{ label: 'Log a session', onClick: () => navigate('/train') }}
        />
      </div>
    );
  }

  return (
    <div className="page perform-page">
      <PageHeader title="Performance" subtitle="Estimated strength and personal records from your logged sessions" />

      {/* Headline lifts */}
      <div className="grid-auto">
        <MetricCard
          label="Big-three total"
          value={total !== null ? convertWeight(total, settings.unitSystem).toLocaleString('en-US') : '—'}
          unit={total !== null ? unit : undefined}
          icon={<Trophy size={18} />}
          source={total !== null ? 'Sum of estimated 1RMs' : 'Needs bench, squat and deadlift'}
        />
        {bigThree.map(lift => (
          <MetricCard
            key={lift.id}
            label={`${lift.label} · est. 1RM`}
            value={lift.value !== undefined ? convertWeight(lift.value, settings.unitSystem) : '—'}
            unit={lift.value !== undefined ? unit : undefined}
            icon={<Zap size={18} />}
            color="var(--series-amber)"
            source={lift.value !== undefined ? `Latest: ${relativeDay(lifts.get(lift.id)!.date)}` : 'No qualifying sets yet'}
          />
        ))}
      </div>

      {/* Estimated 1RM for every lift */}
      <section>
        <SectionHeader
          title="Estimated one-rep maxes"
          subtitle="Epley estimate from the best set of 1–12 reps at RPE 7+ in the most recent week each lift was trained. Change compares that with the first such week."
        />
        <div className="e1rm-grid">
          {liftRows.map(lift => (
            <Card key={lift.id} className="e1rm-card">
              <div className="e1rm-top">
                <span className="e1rm-name">{exerciseName(lift.id)}</span>
                <span className={`e1rm-trend ${lift.changePct > 0 ? 'up' : lift.changePct < 0 ? 'down' : ''}`}>
                  {lift.changePct > 0 ? <ArrowUpRight size={14} /> : lift.changePct < 0 ? <ArrowDownRight size={14} /> : <Minus size={14} />}
                  {lift.changePct > 0 ? '+' : ''}{lift.changePct}%
                </span>
              </div>
              <div className="e1rm-value-row">
                <span className="e1rm-val">{convertWeight(lift.latest, settings.unitSystem)}</span>
                <span className="e1rm-unit">{unit}</span>
              </div>
              <div className="e1rm-sub">Last trained hard: {relativeDay(lift.date)}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* PR log */}
      <section>
        <SectionHeader
          title="Personal records"
          subtitle="Each time a week’s best estimate beat every earlier week for that lift"
        />
        {prs.length === 0 ? (
          <EmptyState
            icon={<Award size={36} />}
            title="No records broken yet"
            description="A record is logged when a lift’s estimated 1RM beats your previous best. Your first week sets the baseline."
          />
        ) : (
          <div className="stack">
            {prs.map((pr) => (
              <Card key={`${pr.exerciseId}-${pr.date}`} className="pr-card">
                <span className="icon-tile pr-badge">
                  <Award size={18} />
                </span>
                <div className="pr-info">
                  <h3 className="pr-exercise">{pr.exerciseName}</h3>
                  <span className="pr-date">{relativeDay(pr.date)}</span>
                </div>
                <div className="pr-values">
                  <strong className="pr-current">{formatWeight(pr.value, settings.unitSystem)}</strong>
                  {pr.previous !== undefined && (
                    <span className="pr-delta">
                      +{formatWeight(pr.value - pr.previous, settings.unitSystem)} on {formatWeight(pr.previous, settings.unitSystem)}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
