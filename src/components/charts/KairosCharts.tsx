import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import './KairosCharts.css';

// ============================================================
// KAIROS CHARTS
// Small, purpose-built visualizations for the overview dashboard.
// Every chart renders an explicit empty state instead of a
// placeholder shape when its window has no logged data.
// ============================================================

const SERIES = {
  accent: 'var(--accent-primary)',
  amber: 'var(--series-amber)',
  sage: 'var(--series-sage)',
  neutral: 'var(--series-neutral)',
};

const AXIS_TICK = { fill: 'var(--text-tertiary)', fontSize: 10 };

function ChartEmpty({ children = 'No data logged in this window' }: { children?: React.ReactNode }) {
  return <div className="kc-empty">{children}</div>;
}

// --- Shared tooltip ---
interface TooltipSeries {
  key: string;
  label: string;
  unit: string;
  color: string;
}

function ChartTooltip({ active, payload, series }: { active?: boolean; payload?: any[]; series: TooltipSeries[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="kc-tooltip">
      <span className="kc-tooltip-title">{row.date}</span>
      {series.map(s => (
        <span className="kc-tooltip-row" key={s.key}>
          <i style={{ background: s.color }}></i>
          {s.label}
          <b>{row[s.key] === null || row[s.key] === undefined ? '—' : `${row[s.key]}${s.unit}`}</b>
        </span>
      ))}
    </div>
  );
}

// --- Activity matrix: one row per domain, one cell per day ---
interface ActivityMatrixProps {
  rows: { label: string; hint: string; cells: { level: number | null; met: boolean }[] }[];
  days: string[];
}

export function ActivityMatrix({ rows, days }: ActivityMatrixProps) {
  const hasData = rows.some(r => r.cells.some(c => c.level !== null));
  if (!hasData) return <ChartEmpty />;

  return (
    <div className="kc-matrix" role="img" aria-label="Training, fuel and sleep adherence for each of the last 7 days">
      {rows.map(row => (
        <React.Fragment key={row.label}>
          <span className="kc-matrix-label" title={row.hint}>{row.label}</span>
          <div className="kc-matrix-track">
            {row.cells.map((cell, i) => (
              <span className="kc-matrix-cell" key={i}>
                {cell.level !== null && (
                  <i
                    className={cell.met ? 'met' : ''}
                    style={{ width: `${Math.max(22, Math.round(cell.level * 100))}%` }}
                  ></i>
                )}
              </span>
            ))}
          </div>
        </React.Fragment>
      ))}
      <span></span>
      <div className="kc-matrix-track kc-axis">
        {days.map((d, i) => <span key={i}>{d}</span>)}
      </div>
    </div>
  );
}

// --- Two-series comparison line chart (e.g. this week vs last week) ---
interface CompareLinesProps {
  data: { label: string; date: string; current: number | null; previous: number | null }[];
  unit: string;
  currentLabel: string;
  previousLabel: string;
}

export function CompareLines({ data, unit, currentLabel, previousLabel }: CompareLinesProps) {
  const values = data.flatMap(d => [d.current, d.previous]).filter((v): v is number => v !== null);
  if (values.length === 0) return <ChartEmpty />;

  // A lone reading has no line to draw, so sparse series are shown as dots
  const dots = (color: string) => (values.length <= 4 ? { r: 2.5, strokeWidth: 0, fill: color } : false);
  const min = Math.floor(Math.min(...values));
  const max = Math.ceil(Math.max(...values));
  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="kc-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255, 255, 255, 0.07)" />
          <XAxis dataKey="date" tickFormatter={(_, i) => data[i]?.label ?? ''} tick={AXIS_TICK} tickLine={false} axisLine={false} interval={0} height={18} />
          <YAxis domain={[min, max]} ticks={ticks} tick={AXIS_TICK} tickLine={false} axisLine={false} width={18} />
          <Tooltip
            cursor={{ stroke: 'rgba(255, 255, 255, 0.14)' }}
            content={(
              <ChartTooltip
                series={[
                  { key: 'current', label: currentLabel, unit, color: SERIES.amber },
                  { key: 'previous', label: previousLabel, unit, color: SERIES.sage },
                ]}
              />
            )}
          />
          <Line type="monotone" dataKey="previous" stroke={SERIES.sage} strokeWidth={1.75} dot={dots(SERIES.sage)} activeDot={{ r: 3, strokeWidth: 0 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="current" stroke={SERIES.amber} strokeWidth={2.25} dot={dots(SERIES.amber)} activeDot={{ r: 3.5, strokeWidth: 0 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Floating bars: each day's value relative to a baseline ---
interface DeviationBarsProps {
  items: { label: string; date: string; value: number | null; highlighted?: boolean }[];
  baseline: number | null;
  unit: string;
  metric: string;
}

export function DeviationBars({ items, baseline, unit, metric }: DeviationBarsProps) {
  const values = items.map(i => i.value).filter((v): v is number => v !== null);
  if (values.length === 0 || baseline === null) return <ChartEmpty />;

  const maxDeviation = Math.max(1, ...values.map(v => Math.abs(v - baseline))) * 1.15;

  return (
    <div className="kc-deviation" role="img" aria-label={`${metric} for each of the last 7 days relative to a baseline of ${baseline}${unit}`}>
      <span className="kc-deviation-baseline" aria-hidden="true"></span>
      {items.map((item, i) => {
        const delta = item.value === null ? 0 : item.value - baseline;
        const size = `${Math.max(7, (Math.abs(delta) / maxDeviation) * 50)}%`;
        return (
          <div className="kc-deviation-col" key={i}>
            <div className="kc-deviation-track" title={item.value === null ? `${item.date}: no data` : `${item.date}: ${item.value}${unit}`}>
              {item.value !== null && (
                <span
                  className={`kc-deviation-pill ${item.highlighted ? 'highlight' : ''}`}
                  style={delta >= 0 ? { bottom: '50%', height: size } : { top: '50%', height: size }}
                ></span>
              )}
            </div>
            <span className={`kc-deviation-label ${item.highlighted ? 'active' : ''}`}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// --- Overlaid trend lines, each on its own scale; the first series is the emphasized one ---
export interface TrendSeries {
  key: string;
  label: string;
  unit: string;
  color: 'accent' | 'amber' | 'sage' | 'neutral';
}

interface TrendLinesProps {
  data: ({ date: string } & Record<string, string | number | null>)[];
  series: TrendSeries[];
}

export function TrendLines({ data, series }: TrendLinesProps) {
  if (!data.some(d => d[series[0].key] !== null)) return <ChartEmpty />;

  const tooltipSeries = series.map(s => ({ ...s, color: SERIES[s.color] }));

  return (
    <div className="kc-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <XAxis dataKey="date" hide />
          {series.map(s => (
            <YAxis key={s.key} yAxisId={s.key} hide domain={['dataMin', 'dataMax']} padding={{ top: 4, bottom: 4 }} />
          ))}
          <Tooltip cursor={{ stroke: 'rgba(255, 255, 255, 0.14)' }} content={<ChartTooltip series={tooltipSeries} />} />
          {[...series].reverse().map((s, i, all) => {
            const primary = i === all.length - 1;
            return (
              <Line
                key={s.key}
                yAxisId={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={SERIES[s.color]}
                strokeWidth={primary ? 2 : 1.25}
                dot={data.filter(d => d[s.key] !== null).length <= 2 ? { r: 2.5, strokeWidth: 0, fill: SERIES[s.color] } : false}
                activeDot={{ r: primary ? 3.5 : 3, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendLegend({ series }: { series: TrendSeries[] }) {
  return (
    <div className="kc-legend">
      {series.map(s => (
        <span key={s.key}><i style={{ background: SERIES[s.color] }}></i>{s.label}</span>
      ))}
    </div>
  );
}
// --- Session waveform: one mirrored bar per exercise, grouped by session ---
interface SessionWaveformProps {
  bars: { id: string; label: string; volume: number; latest: boolean }[];
}

export function SessionWaveform({ bars }: SessionWaveformProps) {
  if (bars.length === 0) return <ChartEmpty>No sessions logged in the last 30 days</ChartEmpty>;

  const max = Math.max(1, ...bars.map(b => b.volume));

  return (
    <div className="kc-waveform" role="img" aria-label="Volume of every exercise across the last 30 days of sessions; the most recent session is highlighted">
      {bars.map(bar => (
        <span
          key={bar.id}
          className={bar.latest ? 'latest' : ''}
          title={`${bar.label}: ${Math.round(bar.volume).toLocaleString('en-US')} kg`}
          style={{ height: `${Math.max(8, (bar.volume / max) * 100)}%` }}
        ></span>
      ))}
    </div>
  );
}

// --- Semicircular athlete-state gauge ---
const GAUGE_TICKS = 49;
const GAUGE_CX = 140;
const GAUGE_CY = 146;

function polar(radius: number, t: number): [number, number] {
  const angle = Math.PI + t * Math.PI;
  return [GAUGE_CX + radius * Math.cos(angle), GAUGE_CY + radius * Math.sin(angle)];
}

interface AthleteGaugeProps {
  /** null draws the empty scale: the score cannot be calculated yet */
  score: number | null;
  caption: string;
}

export function AthleteGauge({ score, caption }: AthleteGaugeProps) {
  const t = score === null ? 0 : Math.min(1, Math.max(0, score / 100));
  const markerIndex = score === null ? -1 : Math.round(t * (GAUGE_TICKS - 1));
  const markerT = markerIndex / (GAUGE_TICKS - 1);

  const [tipX, tipY] = polar(122, markerT);
  const [baseX, baseY] = polar(130, markerT);
  const normal = Math.PI + markerT * Math.PI + Math.PI / 2;
  const dx = 3.5 * Math.cos(normal);
  const dy = 3.5 * Math.sin(normal);

  return (
    <svg viewBox="0 0 280 164" className="kc-gauge" role="img" aria-label={score === null ? `${caption}: not enough data` : `${caption}: ${score} out of 100`}>
      {Array.from({ length: GAUGE_TICKS }, (_, i) => {
        const tickT = i / (GAUGE_TICKS - 1);
        const isMarker = i === markerIndex;
        const [x1, y1] = polar(isMarker ? 92 : 96, tickT);
        const [x2, y2] = polar(116, tickT);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className={isMarker ? 'kc-gauge-marker' : i < markerIndex ? 'kc-gauge-tick active' : 'kc-gauge-tick'}
          />
        );
      })}
      {score !== null && (
        <polygon
          className="kc-gauge-pointer"
          points={`${tipX},${tipY} ${baseX + dx},${baseY + dy} ${baseX - dx},${baseY - dy}`}
        />
      )}
      <text x={GAUGE_CX} y="118" textAnchor="middle" className="kc-gauge-value">
        {score ?? '—'}
        {score !== null && <tspan className="kc-gauge-max" dx="3">/100</tspan>}
      </text>
      <text x={GAUGE_CX} y="140" textAnchor="middle" className="kc-gauge-caption">{caption}</text>
      <text x="24" y="160" textAnchor="middle" className="kc-gauge-scale">0</text>
      <text x="256" y="160" textAnchor="middle" className="kc-gauge-scale">100</text>
    </svg>
  );
}
