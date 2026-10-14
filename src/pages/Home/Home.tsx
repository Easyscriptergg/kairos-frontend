import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKairos, MODE_LABELS } from '../../data/store/KairosStore';
import {
  Card, SectionHeader, StatusBadge, EmptyState,
  RecommendationCard, InsightCard,
} from '../../components/shared/SharedComponents';
import {
  ActivityMatrix, CompareLines, DeviationBars, TrendLines, TrendLegend,
  SessionWaveform, AthleteGauge, TrendSeries,
} from '../../components/charts/KairosCharts';
import { AthleteState } from '../../data/models/types';
import { formatRange, relativeDay } from '../../data/domain/dates';
import { recoveryBand } from '../../data/domain/scoring';
import { buildOverview, formatSigned, splitHours, OverviewMetrics } from './homeMetrics';
import {
  Moon, Heart, Activity, Brain, Dumbbell, Utensils, Trophy, ChevronRight, ChevronDown,
  Play, Plus, Search, CalendarDays, BarChart3, ArrowUp, X, Database,
} from 'lucide-react';
import './Home.css';

// ============================================================
// HOME — ATHLETE COMMAND CENTER
// The living model of the athlete: What happened, why it matters,
// what is changing, and what to do at this exact moment.
// ============================================================

const RECOVERY_SERIES: TrendSeries[] = [
  { key: 'recovery', label: 'Recovery score', unit: '', color: 'accent' },
  { key: 'load', label: '7-day training load', unit: '', color: 'amber' },
  { key: 'restingHR', label: 'Resting HR', unit: ' bpm', color: 'neutral' },
];

export default function Home() {
  const { state } = useKairos();
  const navigate = useNavigate();
  const [showReasoning, setShowReasoning] = useState(false);
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const askRef = useRef<HTMLInputElement>(null);
  const recommendationRef = useRef<HTMLDivElement>(null);

  const { athleteState, profile, recommendation, insights, recovery, workouts, nutrition, timeline } = state;
  const overview = useMemo(() => buildOverview(recovery, workouts, nutrition), [recovery, workouts, nutrition]);
  const mode = MODE_LABELS[state.mode];

  if (!athleteState || !overview) {
    return (
      <div className="home-empty">
        <EmptyState
          icon={<Database size={40} />}
          title="Nothing logged yet"
          description={`You are viewing “${mode.label}”, which has no records. Log a session, a meal or a recovery check-in and your overview will build itself from them.`}
          action={{ label: 'Log a session', onClick: () => navigate('/train') }}
        />
        <div className="home-empty-actions">
          <button className="ov-pill" onClick={() => navigate('/recover')}><Plus size={15} /> Log check-in</button>
          <button className="ov-pill" onClick={() => navigate('/fuel')}><Plus size={15} /> Log meal</button>
          <button className="ov-pill" onClick={() => navigate('/settings')}>Switch data source</button>
        </div>
      </div>
    );
  }

  const balance = getBalanceState(athleteState);
  const domains = [
    { key: 'training', label: 'Training', icon: Dumbbell, path: '/train', score: athleteState.domains.training.score },
    { key: 'recovery', label: 'Recovery', icon: Heart, path: '/recover', score: athleteState.domains.recovery.score },
    { key: 'nutrition', label: 'Nutrition', icon: Utensils, path: '/fuel', score: athleteState.domains.nutrition.score },
    { key: 'performance', label: 'Performance', icon: Trophy, path: '/perform', score: athleteState.domains.performance.score },
  ];

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (trimmed) setAsked(trimmed);
  };

  const trainingTime = splitHours(overview.activity.trainingMinutes / 60);
  const sleepTime = overview.sleep.avgHours !== null ? splitHours(overview.sleep.avgHours) : null;

  return (
    <div className="home-page">
      {/* 1. OVERVIEW — hero, assistant entry point and the performance grid */}
      <section className="overview" aria-label="Athlete overview">
        <header className="ov-top">
          <div className="ov-top-left"></div>

          <div className="ov-ask">
            <h1 className="ov-greeting">{getGreeting(profile?.name)}</h1>
            <form className="ask-form" onSubmit={handleAsk}>
              <label className="sr-only" htmlFor="ask-kairos">Ask Kairos</label>
              <input
                id="ask-kairos"
                ref={askRef}
                className="ask-input"
                type="text"
                placeholder="Ask Kairos anything…"
                autoComplete="off"
                value={question}
                onChange={e => setQuestion(e.target.value)}
              />
              {question.trim() && (
                <button type="submit" className="ask-submit" aria-label="Ask Kairos">
                  <ArrowUp size={16} />
                </button>
              )}
            </form>
            {asked && (
              <div className="ask-note" role="status">
                <p>
                  The Kairos assistant isn’t connected in this build, so “{asked}” wasn’t sent anywhere.
                  Kairos’ current read of your data is already on this page.
                </p>
                <div className="ask-note-actions">
                  <button className="ov-pill" onClick={() => recommendationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                    Today’s recommendation <ChevronDown size={14} />
                  </button>
                  <button className="ov-pill" onClick={() => navigate('/insights')}>
                    Browse insights <ChevronRight size={14} />
                  </button>
                  <button className="ov-icon-btn ov-icon-btn-sm" onClick={() => setAsked(null)} aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="ov-top-right">
            <button className="ov-icon-btn" onClick={() => navigate('/connections')} aria-label="Data sources" title="Data sources">
              <Plus size={18} />
            </button>
            <button className="ov-profile" onClick={() => navigate('/profile')} aria-label={profile ? `${profile.name}, open profile` : 'Set up your profile'}>
              <span className="ov-avatar" aria-hidden="true">{profile ? profile.name.charAt(0).toUpperCase() : <Plus size={16} />}</span>
              <span className="ov-profile-text">
                <span className="ov-profile-name">{profile?.name ?? 'Set up profile'}</span>
                <span className="ov-profile-sub">{profile?.discipline ?? 'No profile yet'}</span>
              </span>
            </button>
          </div>
        </header>

        <div className="ov-controls">
          <button className={`ov-demo ov-demo-${state.mode}`} onClick={() => navigate('/settings')} title={`${mode.description} Change in Settings.`}>
            <span className="ov-demo-dot"></span>
            {mode.label}{state.mode === 'demo' && ' · sample athlete, not real measurements'}
          </button>

          <div className="ov-control-group">
            <button className="ov-icon-btn" onClick={() => askRef.current?.focus()} aria-label="Ask Kairos" title="Ask Kairos">
              <Search size={16} />
            </button>
            <button className="ov-pill" onClick={() => navigate('/calendar')} title="Window shown in the cards below — open calendar">
              <CalendarDays size={15} /> {formatRange(overview.range.start, overview.range.end)}
            </button>
            <button className="ov-pill" onClick={() => navigate('/recover')}>
              <Plus size={15} /> Log check-in
            </button>
            <button className="ov-pill ov-pill-strong" onClick={() => navigate('/train')}>
              <Play size={13} /> Start session
            </button>
          </div>
        </div>

        <div className="ov-grid">
          <div className="ov-main">
            {/* Row 1: key signals */}
            <div className="ov-row ov-row-signals">
              <article className="ov-card ov-signal">
                <SignalHeader icon={<Activity size={18} />} title="Activity" onOpen={() => navigate('/train')} />
                <div className="ov-signal-body">
                  <div className="ov-metric">
                    <span className="ov-num">
                      {trainingTime.h}<small>h</small> {String(trainingTime.m).padStart(2, '0')}<small>m</small>
                    </span>
                    <span className="ov-sub">
                      <Dumbbell size={12} /> {overview.activity.sessions} {overview.activity.sessions === 1 ? 'session' : 'sessions'}
                    </span>
                  </div>
                  <div className="ov-viz ov-viz-end">
                    <ActivityMatrix rows={overview.activity.rows} days={overview.days} />
                  </div>
                </div>
              </article>

              <article className="ov-card ov-signal">
                <SignalHeader icon={<Moon size={18} />} title="Sleep" tone="sleep" onOpen={() => navigate('/recover')} />
                <div className="ov-signal-body">
                  <div className="ov-metric">
                    <span className="ov-num">
                      {sleepTime ? <>{sleepTime.h}<small>h</small> {String(sleepTime.m).padStart(2, '0')}<small>m</small></> : '—'}
                    </span>
                    <span className="ov-sub">
                      {overview.sleep.deltaMinutes !== null
                        ? `${formatSigned(overview.sleep.deltaMinutes, 'm')} vs prior week`
                        : overview.sleep.nights === 0 ? 'No sleep logged this week'
                        : `Avg of ${overview.sleep.nights} ${overview.sleep.nights === 1 ? 'night' : 'nights'}`}
                    </span>
                  </div>
                  <div className="ov-viz">
                    <span className="ov-viz-caption">
                      <i style={{ background: 'var(--series-amber)' }}></i>This week
                      <i style={{ background: 'var(--series-sage)' }}></i>Prior week
                    </span>
                    <div className="ov-viz-chart">
                      <CompareLines data={overview.sleep.series} unit="h" currentLabel="This week" previousLabel="Prior week" />
                    </div>
                  </div>
                </div>
              </article>

              <article className="ov-card ov-signal">
                <SignalHeader icon={<Heart size={18} />} title="Heart" tone="heart" onOpen={() => navigate('/recover')} />
                <div className="ov-signal-body">
                  <div className="ov-metric">
                    <span className="ov-num">
                      {overview.heart.restingHR ?? '—'} <small>BPM</small>
                    </span>
                    <span className="ov-sub">
                      <Heart size={12} className="ov-sub-accent" /> Resting heart rate
                    </span>
                  </div>
                  <div className="ov-viz">
                    <span className="ov-viz-caption">
                      HRV {overview.heart.hrv !== null ? `${overview.heart.hrv} ms` : '—'}
                      {overview.heart.baseline !== null && ` · 30-day avg ${overview.heart.baseline}`}
                    </span>
                    <div className="ov-viz-chart">
                      <DeviationBars items={overview.heart.bars} baseline={overview.heart.baseline} unit=" ms" metric="Heart rate variability" />
                    </div>
                  </div>
                </div>
              </article>
            </div>

            {/* Row 2: 30-day analysis */}
            <div className="ov-row ov-row-analysis">
              <article className="ov-card ov-analysis">
                <AnalysisHeader
                  title="Recovery"
                  value={overview.recovery.score ?? '—'}
                  label={recoveryLabel(overview.recovery.score)}
                  sub={overview.recovery.deltaVsWeek !== null ? `${formatSigned(overview.recovery.deltaVsWeek)} vs 7-day average` : 'Log a check-in to score recovery'}
                />
                <div className="ov-analysis-chart">
                  <TrendLines data={overview.recovery.trend} series={RECOVERY_SERIES} />
                </div>
                <TrendLegend series={RECOVERY_SERIES} />
                <AnalysisFooter
                  left={{ label: 'Sleep avg', value: overview.recovery.sleepAvg !== null ? `${overview.recovery.sleepAvg.toFixed(1)}h` : '—' }}
                  right={{ label: 'HRV', value: overview.recovery.hrv !== null ? `${overview.recovery.hrv} ms` : '—' }}
                  onOpen={() => navigate('/recover')}
                />
              </article>

              <article className="ov-card ov-analysis">
                <AnalysisHeader
                  title="Training load"
                  value={overview.load.load7}
                  label="7-day load"
                  sub={overview.load.deltaPct !== null ? `${formatSigned(overview.load.deltaPct, '%')} vs prior week` : 'No prior week to compare'}
                />
                <div className="ov-analysis-chart">
                  <SessionWaveform bars={overview.load.waveform} />
                </div>
                <div className="kc-legend">
                  <span><i style={{ background: 'var(--series-neutral)' }}></i>Exercise volume, last 30 days</span>
                  <span><i style={{ background: 'var(--accent-primary)' }}></i>Latest session</span>
                </div>
                <AnalysisFooter
                  left={{ label: 'Avg session', value: overview.load.avgSessionMinutes !== null ? `${overview.load.avgSessionMinutes} min` : '—' }}
                  right={{ label: 'Sessions', value: String(overview.load.sessions30) }}
                  onOpen={() => navigate('/train')}
                />
              </article>
            </div>
          </div>

          {/* Signature athlete-state panel */}
          <aside className="ov-card state-panel" aria-label="Athlete state">
            <div className="state-domains">
              {domains.map(d => (
                <button key={d.key} className="state-chip" onClick={() => navigate(d.path)} title={`${d.label} score ${d.score ?? 'not available yet'} — open ${d.label.toLowerCase()}`}>
                  <span className="state-chip-icon"><d.icon size={16} strokeWidth={1.75} /></span>
                  <span className="state-chip-score">{d.score ?? '—'}</span>
                  <span className="sr-only">{d.label}</span>
                </button>
              ))}
            </div>

            <div className="state-gauge">
              <AthleteGauge score={athleteState.overallScore} caption="Athlete balance" />
            </div>

            <div className="state-copy">
              {athleteState.readiness && (
                <StatusBadge
                  status={`Readiness: ${athleteState.readiness}`}
                  variant={athleteState.readiness === 'ready' || athleteState.readiness === 'peak' ? 'success' : 'warning'}
                />
              )}
              <h2 className="state-name">{balance.name}</h2>
              <p className="state-desc">{balance.description}</p>
              <p className="state-footnote">Weighted mean of the four domain scores above — an internal Kairos calculation, not a clinical measure</p>
            </div>
          </aside>
        </div>
      </section>

      {/* 2. TODAY'S KAIROS + PERFORMANCE BRIEF */}
      <div className={`action-grid ${recommendation ? '' : 'action-grid-single'}`} ref={recommendationRef}>
        {recommendation && (
          <RecommendationCard
            title={recommendation.title}
            message={recommendation.message}
            reasoning={recommendation.reasoning}
            actionLabel={recommendation.actionLabel}
            onAction={() => navigate(recommendation.action)}
            showReasoning={showReasoning}
            onToggleReasoning={() => setShowReasoning(!showReasoning)}
          />
        )}
        <Card className="performance-brief-card">
          <div className="brief-icon">
            <Brain size={20} />
          </div>
          <div className="brief-content">
            <span className="brief-kicker">Performance brief</span>
            <p className="brief-text">
              {generatePerformanceBrief(athleteState, overview)}
            </p>
            <div className="brief-tags">
              <span className="brief-tag">{mode.label}</span>
              <span className="brief-tag">Calculated from your log</span>
              <span className="brief-tag">{insights.length} {insights.length === 1 ? 'pattern' : 'patterns'} found</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 3. WHAT KAIROS LEARNED (INSIGHTS) */}
      <div className="insights-section">
        <SectionHeader
          title="What Kairos Noticed"
          subtitle="Cross-domain patterns in your training, recovery and nutrition"
          action={
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/insights')}>
              View all insights <ChevronRight size={14} />
            </button>
          }
        />
        {insights.length === 0 && (
          <p className="home-section-empty">No patterns yet — comparisons need a few weeks of sessions alongside recovery or nutrition logs.</p>
        )}
        <div className="home-insights-grid">
          {insights.slice(0, 3).map(insight => (
            <InsightCard
              key={insight.id}
              title={insight.title}
              observation={insight.observation}
              evidence={insight.evidence}
              recommendation={insight.recommendation}
              category={insight.category}
              confidence={insight.confidence}
              domains={insight.domains}
            />
          ))}
        </div>
      </div>

      {/* 4. TIMELINE LEDGER */}
      <div className="timeline-section">
        <SectionHeader
          title="Recent Activity"
          subtitle="Latest training, recovery and nutrition records"
          action={
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/calendar')}>
              Full calendar <ChevronRight size={14} />
            </button>
          }
        />
        <div className="home-timeline">
          {timeline.slice(0, 5).map(event => (
            <div className="timeline-item" key={event.id}>
              <div className="timeline-marker">
                <div className={`timeline-dot dot-${event.type}`}></div>
                <div className="timeline-line"></div>
              </div>
              <div className="timeline-content">
                <div className="timeline-header">
                  <span className="timeline-date">{relativeDay(event.date)}</span>
                  {event.time && <span className="timeline-time">{event.time}</span>}
                  {event.value && <span className="timeline-value">{event.value}</span>}
                </div>
                <p className="timeline-title">{event.title}</p>
                <p className="timeline-desc">{event.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. QUICK ACTION BUTTONS */}
      <div className="home-quick-actions">
        <button className="quick-action" onClick={() => navigate('/train')}>
          <Dumbbell size={20} />
          <span>Start Workout</span>
        </button>
        <button className="quick-action" onClick={() => navigate('/fuel')}>
          <Utensils size={20} />
          <span>Log Meal</span>
        </button>
        <button className="quick-action" onClick={() => navigate('/recover')}>
          <Moon size={20} />
          <span>Log Recovery</span>
        </button>
        <button className="quick-action" onClick={() => navigate('/insights')}>
          <Brain size={20} />
          <span>View Insights</span>
        </button>
      </div>
    </div>
  );
}

// --- Card building blocks ---
function SignalHeader({ icon, title, tone, onOpen }: { icon: React.ReactNode; title: string; tone?: 'sleep' | 'heart'; onOpen: () => void }) {
  return (
    <div className="ov-card-header">
      <button className="ov-card-title" onClick={onOpen} aria-label={`${title} — open details`}>
        <span className={`ov-icon-tile ${tone ? `tile-${tone}` : ''}`}>{icon}</span>
        {title}
      </button>
      <span className="ov-card-period">Last 7 days</span>
    </div>
  );
}

function AnalysisHeader({ title, value, label, sub }: { title: string; value: string | number; label: string; sub: string }) {
  return (
    <div className="ov-analysis-header">
      <h3 className="ov-analysis-title">{title}</h3>
      <div className="ov-analysis-score">
        <span className="ov-analysis-value">{value}</span>
        <span className="ov-analysis-label">{label}</span>
        <span className="ov-analysis-sub">{sub}</span>
      </div>
      <span className="ov-card-period">Last 30 days</span>
    </div>
  );
}

interface FooterStat {
  label: string;
  value: string;
}

function AnalysisFooter({ left, right, onOpen }: { left: FooterStat; right: FooterStat; onOpen: () => void }) {
  return (
    <div className="ov-analysis-footer">
      <div className="ov-stat">
        <span className="ov-stat-label">{left.label}</span>
        <span className="ov-stat-value">{left.value}</span>
      </div>
      <button className="ov-details" onClick={onOpen}>
        <span className="ov-details-icon"><BarChart3 size={15} /></span>
        Details
      </button>
      <div className="ov-stat ov-stat-right">
        <span className="ov-stat-label">{right.label}</span>
        <span className="ov-stat-value">{right.value}</span>
      </div>
    </div>
  );
}

// --- Helpers ---
function getGreeting(name?: string): string {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${greeting}, ${name}.` : `${greeting}.`;
}

function recoveryLabel(score: number | null): string {
  if (score === null) return 'No check-in this week';
  return { high: 'High recovery', moderate: 'Moderate recovery', low: 'Low recovery' }[recoveryBand(score)];
}

function getBalanceState(state: AthleteState): { name: string; description: string } {
  const training = state.domains.training.score;
  const recovery = state.domains.recovery.score;
  const fuel = state.domains.nutrition.score;
  const performance = state.domains.performance.score;

  if (training === null || recovery === null || fuel === null || performance === null) {
    return { name: 'Still building', description: 'A balance reading needs training, recovery, nutrition and strength data. Domains without records show a dash.' };
  }
  if (recovery < 65 && training >= 75) {
    return { name: 'Recovery-limited', description: 'Recovery is lagging the current training load. Prioritise sleep and easier sessions.' };
  }
  if (fuel < 68 && training >= 75) {
    return { name: 'Under-fuelled', description: 'Nutrition is lagging the current training load. Bring energy and protein intake back to target.' };
  }
  if (training >= 82 && recovery >= 80 && performance >= 80) {
    return { name: 'Primed to perform', description: 'Training, recovery and performance scores are all high at the same time.' };
  }
  if (training >= 80 && recovery < 75) {
    return { name: 'Training-heavy', description: 'Training is scoring well ahead of recovery. Watch fatigue over the next few days.' };
  }

  const scores = [
    { label: 'Training', score: training },
    { label: 'Recovery', score: recovery },
    { label: 'Nutrition', score: fuel },
    { label: 'Performance', score: performance },
  ].sort((a, b) => a.score - b.score);
  if (scores[3].score - scores[0].score > 25) {
    return { name: 'Uneven', description: `${scores[0].label} is well below your other scores this week and is pulling the balance down.` };
  }
  return { name: 'Balanced', description: 'Training, recovery, nutrition and performance scores are within range of each other.' };
}

function generatePerformanceBrief(state: AthleteState, overview: OverviewMetrics): string {
  const parts: string[] = [];

  if (state.domains.performance.score !== null && state.domains.performance.trend === 'improving') {
    parts.push('Estimated strength is trending up, so progressive overload is working.');
  } else if (state.domains.performance.trend === 'declining') {
    parts.push('Estimated strength has dipped recently — a lighter week may be worth considering.');
  }

  if (state.domains.recovery.trend === 'improving' && overview.heart.hrv !== null && overview.heart.baseline !== null && overview.heart.restingHR !== null) {
    parts.push(`Recovery is trending up: HRV is ${overview.heart.hrv} ms against a 30-day average of ${overview.heart.baseline} ms, with resting heart rate at ${overview.heart.restingHR} bpm.`);
  }

  if (state.fatigue === 'low') {
    parts.push('Fatigue is low, which makes this a reasonable window for higher-intensity work.');
  } else if (state.fatigue === 'moderate') {
    parts.push('Fatigue is moderate — normal training loads should remain well-tolerated.');
  } else if (state.fatigue !== null) {
    parts.push('Fatigue is high — prioritise sleep and keep sessions light until recovery scores rise.');
  }

  if (state.nutritionStatus === 'good' || state.nutritionStatus === 'excellent') {
    parts.push('Energy and protein intake have been close to target over the last week.');
  } else if (state.nutritionStatus !== null) {
    parts.push('Energy or protein intake has been below target on the days you logged.');
  }

  if (parts.length === 0) {
    parts.push('There is not enough logged yet to summarise your week. Keep logging sessions, check-ins and meals.');
  }

  return parts.join(' ');
}
