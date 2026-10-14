import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKairos } from '../../data/store/KairosStore';
import {
  InsightCard, PageHeader, FilterChips, EmptyState, Notice,
} from '../../components/shared/SharedComponents';
import { Brain, Calculator } from 'lucide-react';
import './Insights.css';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'sleep-performance', label: 'Sleep & performance' },
  { id: 'load-fatigue', label: 'Load & fatigue' },
  { id: 'recovery-training', label: 'Recovery' },
  { id: 'nutrition-performance', label: 'Nutrition & performance' },
  { id: 'volume-progress', label: 'Strength progress' },
];

export default function Insights() {
  const { state } = useKairos();
  const navigate = useNavigate();
  const { insights } = state;
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(insights[0]?.id || null);

  const filteredInsights = insights.filter(i => selectedCategory === 'all' || i.category === selectedCategory);

  return (
    <div className="page insights-page">
      <PageHeader
        title="Insights"
        subtitle="Patterns found by comparing your own training, recovery and nutrition records"
      />

      <Notice icon={<Calculator size={20} />} title="How these are produced">
        Each insight is a fixed comparison calculated from your log — for example, sessions after long and short nights of sleep.
        They are associations, not proof of cause, and no AI model is involved yet.
      </Notice>

      {insights.length === 0 ? (
        <EmptyState
          icon={<Brain size={36} />}
          title="Not enough data for insights yet"
          description="Insights need a few weeks of sessions alongside recovery check-ins or nutrition logs before a comparison is meaningful."
          action={{ label: 'Log a session', onClick: () => navigate('/train') }}
        />
      ) : (
        <>
          <FilterChips options={CATEGORIES} value={selectedCategory} onChange={setSelectedCategory} label="Filter insights by category" />

          {filteredInsights.length === 0 ? (
            <EmptyState icon={<Brain size={36} />} title="Nothing in this category" description="No pattern in this category met the threshold for being worth showing." />
          ) : (
            <div className="stack">
              {filteredInsights.map(insight => (
                <InsightCard
                  key={insight.id}
                  title={insight.title}
                  observation={insight.observation}
                  evidence={`${insight.evidence} ${insight.interpretation}`}
                  recommendation={insight.recommendation}
                  category={insight.category}
                  confidence={insight.confidence}
                  domains={insight.domains}
                  expanded={expandedId === insight.id}
                  onToggle={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
