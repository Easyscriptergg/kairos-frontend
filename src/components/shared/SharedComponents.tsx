import React, { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import './SharedComponents.css';

// ============================================================
// SHARED UI COMPONENTS
// Reusable building blocks for the Kairos interface
// ============================================================

// --- Metric Card ---
interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  target?: string | number;
  trend?: 'improving' | 'stable' | 'declining';
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  source?: string;
  onClick?: () => void;
}

export function MetricCard({ label, value, unit, target, trend, color, size = 'md', icon, source, onClick }: MetricCardProps) {
  return (
    <div className={`metric-card metric-card-${size} ${onClick ? 'clickable' : ''}`} onClick={onClick} style={{ '--metric-color': color } as React.CSSProperties}>
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        {trend && (
          <span className={`metric-trend trend-${trend}`}>
            {trend === 'improving' ? <TrendingUp size={14} /> : trend === 'declining' ? <TrendingDown size={14} /> : <Minus size={14} />}
          </span>
        )}
      </div>
      <div className="metric-value-row">
        {icon && <span className="metric-icon">{icon}</span>}
        <span className="metric-value">{value}</span>
        {unit && <span className="metric-unit">{unit}</span>}
        {target !== undefined && <span className="metric-target">/ {target}{unit ? ` ${unit}` : ''}</span>}
      </div>
      {source && <div className="metric-source">{source}</div>}
    </div>
  );
}

// --- Score Ring ---
interface ScoreRingProps {
  score: number;
  maxScore?: number;
  label: string;
  sublabel?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  animated?: boolean;
}

export function ScoreRing({ score, maxScore = 100, label, sublabel, size = 'md', color, animated = true }: ScoreRingProps) {
  const percentage = (score / maxScore) * 100;
  const sizeMap = { sm: 64, md: 100, lg: 140, xl: 200 };
  const strokeMap = { sm: 4, md: 6, lg: 8, xl: 10 };
  const dim = sizeMap[size];
  const stroke = strokeMap[size];
  const radius = (dim - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - percentage / 100);

  const getColor = () => {
    if (color) return color;
    if (percentage >= 80) return 'var(--color-success)';
    if (percentage >= 60) return 'var(--accent-primary)';
    if (percentage >= 40) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  return (
    <div className={`score-ring score-ring-${size}`}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          stroke="var(--border-primary)"
          strokeWidth={stroke}
        />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={animated ? dashoffset : dashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${dim / 2} ${dim / 2})`}
          className={animated ? 'ring-progress' : ''}
          style={{ '--ring-offset': dashoffset, '--ring-circumference': circumference } as React.CSSProperties}
        />
      </svg>
      <div className="ring-content">
        <span className="ring-score" style={{ color: getColor() }}>{score}</span>
        {sublabel && <span className="ring-sublabel">{sublabel}</span>}
      </div>
      <span className="ring-label">{label}</span>
    </div>
  );
}

// --- Domain Score Bar ---
interface DomainScoreProps {
  label: string;
  score: number;
  trend?: 'improving' | 'stable' | 'declining';
  color?: string;
}

export function DomainScore({ label, score, trend, color }: DomainScoreProps) {
  const barColor = color || (score >= 80 ? 'var(--color-success)' : score >= 60 ? 'var(--accent-primary)' : score >= 40 ? 'var(--color-warning)' : 'var(--color-danger)');

  return (
    <div className="domain-score">
      <div className="domain-header">
        <span className="domain-label">{label}</span>
        <div className="domain-right">
          <span className="domain-value">{score}</span>
          {trend && (
            <span className={`domain-trend trend-${trend}`}>
              {trend === 'improving' ? <ArrowUpRight size={12} /> : trend === 'declining' ? <ArrowDownRight size={12} /> : <Minus size={12} />}
            </span>
          )}
        </div>
      </div>
      <div className="domain-bar-bg">
        <div className="domain-bar-fill" style={{ width: `${score}%`, background: barColor }}></div>
      </div>
    </div>
  );
}

// --- Insight Card ---
interface InsightCardProps {
  title: string;
  observation: string;
  evidence?: string;
  recommendation?: string;
  category?: string;
  confidence?: number;
  domains?: string[];
  expanded?: boolean;
  onToggle?: () => void;
}

export function InsightCard({ title, observation, evidence, recommendation, category, confidence, domains, expanded, onToggle }: InsightCardProps) {
  return (
    <div className={`insight-card ${expanded ? 'expanded' : ''}`}>
      <div className="insight-header" onClick={onToggle} role={onToggle ? 'button' : undefined} tabIndex={onToggle ? 0 : undefined}>
        <div className="insight-title-row">
          {category && <span className="insight-category">{category.replace('-', ' → ')}</span>}
          <h3 className="insight-title">{title}</h3>
        </div>
        {confidence !== undefined && confidence !== null && (
          <div className="insight-confidence">
            <span className="confidence-value">{Math.round(confidence * 100)}%</span>
            <span className="confidence-label">confidence</span>
          </div>
        )}
      </div>
      <p className="insight-observation">{observation}</p>
      {expanded && (
        <div className="insight-details animate-fade-in-up">
          {evidence && (
            <div className="insight-section">
              <span className="insight-section-label">Evidence</span>
              <p>{evidence}</p>
            </div>
          )}
          {recommendation && (
            <div className="insight-section">
              <span className="insight-section-label">Recommendation</span>
              <p>{recommendation}</p>
            </div>
          )}
          {domains && domains.length > 0 && (
            <div className="insight-domains">
              {domains.map(d => <span key={d} className="domain-tag">{d}</span>)}
            </div>
          )}
        </div>
      )}
      {onToggle && !expanded && (
        <button className="insight-expand-btn" onClick={onToggle}>
          <Info size={14} />
          See evidence
        </button>
      )}
    </div>
  );
}

// --- Recommendation Card ---
interface RecommendationCardProps {
  title: string;
  message: string;
  reasoning?: string;
  actionLabel: string;
  onAction: () => void;
  showReasoning?: boolean;
  onToggleReasoning?: () => void;
}

export function RecommendationCard({ title, message, reasoning, actionLabel, onAction, showReasoning, onToggleReasoning }: RecommendationCardProps) {
  return (
    <div className="recommendation-card">
      <div className="recommendation-accent"></div>
      <div className="recommendation-content">
        <span className="recommendation-label">{title}</span>
        <p className="recommendation-message">{message}</p>
        {showReasoning && reasoning && (
          <div className="recommendation-reasoning animate-fade-in-up">
            <span className="reasoning-label">Why this recommendation?</span>
            <p>{reasoning}</p>
          </div>
        )}
        <div className="recommendation-actions">
          <button className="btn btn-primary" onClick={onAction}>{actionLabel}</button>
          {reasoning && (
            <button className="btn btn-ghost" onClick={onToggleReasoning}>
              {showReasoning ? 'Hide reasoning' : 'Why?'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Status Badge ---
interface StatusBadgeProps {
  status: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export function StatusBadge({ status, variant = 'neutral' }: StatusBadgeProps) {
  return (
    <span className={`status-badge badge-${variant}`}>
      <span className="badge-indicator"></span>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// --- Card ---
interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', padding = 'md', hoverable, onClick }: CardProps) {
  return (
    <div
      className={`card card-pad-${padding} ${hoverable ? 'card-hoverable' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

// --- Section Header ---
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}

// --- Empty State ---
interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-description">{description}</p>
      {action && (
        <button className="btn btn-primary" onClick={action.onClick}>{action.label}</button>
      )}
    </div>
  );
}

// --- Progress Bar ---
interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  color?: string;
  showValue?: boolean;
}

export function ProgressBar({ value, max, label, color, showValue = true }: ProgressBarProps) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="progress-bar-container">
      {(label || showValue) && (
        <div className="progress-bar-header">
          {label && <span className="progress-bar-label">{label}</span>}
          {showValue && <span className="progress-bar-value">{value} / {max}</span>}
        </div>
      )}
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color || 'var(--accent-primary)' }}></div>
      </div>
    </div>
  );
}

// --- Tab Navigation ---
interface TabsProps {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
        >
          {tab.label}
          {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

// --- Page Header ---
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Buttons or status shown on the right */
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

// --- Filter Chips ---
interface FilterChipsProps {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}

export function FilterChips({ options, value, onChange, label }: FilterChipsProps) {
  return (
    <div className="chip-row" role="group" aria-label={label}>
      {options.map(option => (
        <button
          key={option.id}
          className={`chip ${value === option.id ? 'active' : ''}`}
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// --- Form Field ---
interface FieldProps {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, className = '', children }: FieldProps) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

// --- Notice ---
interface NoticeProps {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'danger';
  action?: ReactNode;
}

export function Notice({ icon, title, children, tone = 'neutral', action }: NoticeProps) {
  return (
    <div className={`notice notice-${tone}`}>
      {icon && <span className="notice-icon">{icon}</span>}
      <div className="notice-body">
        <h4 className="notice-title">{title}</h4>
        <p className="notice-desc">{children}</p>
      </div>
      {action && <div className="notice-action">{action}</div>}
    </div>
  );
}
