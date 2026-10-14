import React, { useState } from 'react';
import { useKairos } from '../../data/store/KairosStore';
import {
  Card, SectionHeader, MetricCard, ProgressBar, PageHeader, Field, EmptyState,
} from '../../components/shared/SharedComponents';
import { DEFAULT_NUTRITION_TARGETS } from '../../data/domain/records';
import { relativeDay, todayKey } from '../../data/domain/dates';
import {
  Utensils, Droplets, Flame, Plus, Check, Beef, Wheat, Cookie,
} from 'lucide-react';
import './Fuel.css';

const nowTime = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function Fuel() {
  const { state, actions } = useKairos();
  const { nutrition, athleteState } = state;
  const today = todayKey();
  // Show today once something is logged for it; until then, the most recent logged day
  const day = nutrition.find(n => n.date === today) ?? nutrition[nutrition.length - 1] ?? null;
  const targets = day?.targets ?? DEFAULT_NUTRITION_TARGETS;
  const showingToday = day?.date === today;

  const [showMealModal, setShowMealModal] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealTime, setMealTime] = useState(nowTime);
  const [mealCalories, setMealCalories] = useState('');
  const [mealProtein, setMealProtein] = useState('');
  const [mealCarbs, setMealCarbs] = useState('');
  const [mealFat, setMealFat] = useState('');
  const [saving, setSaving] = useState(false);

  const macros = [mealCalories, mealProtein, mealCarbs, mealFat];
  const formValid = mealName.trim() !== '' && mealTime !== '' && macros.every(v => v !== '' && Number(v) >= 0) && Number(mealCalories) > 0;

  const handleAddMeal = async () => {
    setSaving(true);
    const saved = await actions.logMeal(today, {
      name: mealName.trim(),
      time: mealTime,
      calories: Number(mealCalories),
      protein: Number(mealProtein),
      carbohydrates: Number(mealCarbs),
      fat: Number(mealFat),
    });
    setSaving(false);
    if (!saved) return;
    setShowMealModal(false);
    setMealName('');
    setMealCalories('');
    setMealProtein('');
    setMealCarbs('');
    setMealFat('');
  };

  const progress = [
    { label: 'Energy', icon: <Flame size={16} />, value: day?.calories ?? 0, target: targets.calories, unit: 'kcal', color: 'var(--accent-primary)' },
    { label: 'Protein', icon: <Beef size={16} />, value: day?.protein ?? 0, target: targets.protein, unit: 'g', color: 'var(--macro-protein)' },
    { label: 'Carbohydrates', icon: <Wheat size={16} />, value: day?.carbohydrates ?? 0, target: targets.carbohydrates, unit: 'g', color: 'var(--macro-carbs)' },
    { label: 'Fat', icon: <Cookie size={16} />, value: day?.fat ?? 0, target: targets.fat, unit: 'g', color: 'var(--macro-fat)' },
  ];

  return (
    <div className="page fuel-page">
      <PageHeader
        title="Nutrition"
        subtitle="Energy, macronutrients and hydration against your daily targets"
        actions={
          <button className="btn btn-primary" onClick={() => { setMealTime(nowTime()); setShowMealModal(!showMealModal); }}>
            <Plus size={16} /> Log meal
          </button>
        }
      />

      {/* Log meal form */}
      {showMealModal && (
        <Card padding="lg" className="drawer animate-fade-in-up">
          <SectionHeader
            title="Log a meal"
            subtitle="Added to today. The day’s totals are the sum of its meals."
          />
          <div className="form-grid">
            <Field label="Meal" className="full-span">
              <input type="text" className="control-input" placeholder="e.g. Chicken, rice and vegetables" value={mealName} onChange={(e) => setMealName(e.target.value)} />
            </Field>
            <Field label="Time">
              <input type="time" className="control-input" value={mealTime} onChange={(e) => setMealTime(e.target.value)} />
            </Field>
            <Field label="Energy (kcal)">
              <input type="number" min="0" className="control-input" placeholder="0" value={mealCalories} onChange={(e) => setMealCalories(e.target.value)} />
            </Field>
            <Field label="Protein (g)">
              <input type="number" min="0" className="control-input" placeholder="0" value={mealProtein} onChange={(e) => setMealProtein(e.target.value)} />
            </Field>
            <Field label="Carbohydrates (g)">
              <input type="number" min="0" className="control-input" placeholder="0" value={mealCarbs} onChange={(e) => setMealCarbs(e.target.value)} />
            </Field>
            <Field label="Fat (g)">
              <input type="number" min="0" className="control-input" placeholder="0" value={mealFat} onChange={(e) => setMealFat(e.target.value)} />
            </Field>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleAddMeal} disabled={!formValid || saving}>
              <Check size={16} /> {saving ? 'Saving…' : 'Save meal'}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowMealModal(false)}>
              Cancel
            </button>
          </div>
        </Card>
      )}

      {!day ? (
        <EmptyState
          icon={<Utensils size={36} />}
          title="No meals logged yet"
          description="Log a meal to see your energy and macronutrient intake against your daily targets."
          action={showMealModal ? undefined : { label: 'Log a meal', onClick: () => setShowMealModal(true) }}
        />
      ) : (
        <>
          {/* Target vs actual */}
          <section>
            <SectionHeader
              title={showingToday ? 'Today' : `Latest logged day · ${relativeDay(day.date)}`}
              subtitle={showingToday ? 'Intake so far against your targets' : 'Nothing is logged for today yet, so the most recent day is shown'}
            />
            <div className="grid-auto">
              {progress.map(p => (
                <Card key={p.label} className="fuel-target-card">
                  <div className="target-top">
                    <span className="target-label" style={{ color: p.color }}>{p.icon}<span>{p.label}</span></span>
                    <span className="target-status">
                      <strong>{p.value.toLocaleString('en-US')}</strong> / {p.target.toLocaleString('en-US')} {p.unit}
                    </span>
                  </div>
                  <ProgressBar value={p.value} max={p.target} color={p.color} showValue={false} />
                </Card>
              ))}
            </div>
          </section>

          {/* Supporting metrics */}
          <div className="grid-auto">
            <MetricCard
              label="Hydration"
              value={day.hydration ?? '—'}
              unit={day.hydration !== null ? 'L' : undefined}
              target={day.hydration !== null ? targets.hydration : undefined}
              icon={<Droplets size={18} />}
              color="var(--accent-secondary)"
              source={day.hydration !== null ? relativeDay(day.date) : 'Not logged for this day'}
            />
            <MetricCard
              label="7-day target adherence"
              value={athleteState?.domains.nutrition.score ?? '—'}
              unit={athleteState?.domains.nutrition.score != null ? '%' : undefined}
              trend={athleteState?.domains.nutrition.score != null ? athleteState.domains.nutrition.trend : undefined}
              icon={<Utensils size={18} />}
              color="var(--series-sage)"
              source="Energy and protein vs target · completed, logged days"
            />
            <MetricCard
              label="Protein per meal"
              value={day.meals.length ? Math.round(day.protein / day.meals.length) : '—'}
              unit={day.meals.length ? 'g avg' : undefined}
              icon={<Beef size={18} />}
              source={`${day.meals.length} ${day.meals.length === 1 ? 'meal' : 'meals'} · ${relativeDay(day.date)}`}
            />
          </div>

          {/* Logged meals */}
          <section>
            <SectionHeader title="Meals" subtitle={`${relativeDay(day.date)}, in the order they were eaten`} />
            <div className="stack">
              {[...day.meals].sort((a, b) => a.time.localeCompare(b.time)).map((meal) => (
                <Card key={meal.id} className="meal-card">
                  <div className="meal-card-top">
                    <div className="meal-info">
                      <span className="meal-time">{meal.time}</span>
                      <h3 className="meal-name">{meal.name}</h3>
                    </div>
                    <span className="tag tag-accent"><Flame size={13} /> {meal.calories} kcal</span>
                  </div>
                  <div className="meal-macros-chips">
                    <span className="tag"><i style={{ background: 'var(--macro-protein)' }}></i>Protein {meal.protein} g</span>
                    <span className="tag"><i style={{ background: 'var(--macro-carbs)' }}></i>Carbs {meal.carbohydrates} g</span>
                    <span className="tag"><i style={{ background: 'var(--macro-fat)' }}></i>Fat {meal.fat} g</span>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
