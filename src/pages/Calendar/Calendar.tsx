import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKairos } from '../../data/store/KairosStore';
import { Card, PageHeader, FilterChips, EmptyState } from '../../components/shared/SharedComponents';
import { TimelineEvent } from '../../data/models/types';
import { longDate, relativeDay } from '../../data/domain/dates';
import { Calendar as CalendarIcon, Dumbbell, Moon, Utensils } from 'lucide-react';
import './Calendar.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'training', label: 'Training' },
  { id: 'recovery', label: 'Recovery' },
  { id: 'nutrition', label: 'Nutrition' },
];

const PAGE_SIZE = 14;

const EVENT_ICONS: Partial<Record<TimelineEvent['type'], React.ReactNode>> = {
  training: <Dumbbell size={16} />,
  recovery: <Moon size={16} />,
  nutrition: <Utensils size={16} />,
};

export default function Calendar() {
  const { state } = useKairos();
  const navigate = useNavigate();
  const { timeline } = state;
  const [filterType, setFilterType] = useState<string>('all');
  const [visibleDays, setVisibleDays] = useState(PAGE_SIZE);

  const filteredTimeline = timeline.filter(item => filterType === 'all' || item.type === filterType);

  // Group events by day, newest first
  const days: { date: string; events: TimelineEvent[] }[] = [];
  for (const event of filteredTimeline) {
    const last = days[days.length - 1];
    if (last?.date === event.date) last.events.push(event);
    else days.push({ date: event.date, events: [event] });
  }

  return (
    <div className="page calendar-page">
      <PageHeader title="Calendar" subtitle="Every logged session, check-in and day of nutrition, newest first" />

      {timeline.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon size={36} />}
          title="Nothing logged yet"
          description="Sessions, recovery check-ins and meals appear here as you log them."
          action={{ label: 'Log a session', onClick: () => navigate('/train') }}
        />
      ) : (
        <>
          <FilterChips
            options={FILTERS}
            value={filterType}
            onChange={(id) => { setFilterType(id); setVisibleDays(PAGE_SIZE); }}
            label="Filter events by type"
          />

          {days.length === 0 ? (
            <EmptyState icon={<CalendarIcon size={36} />} title="No events of this type" description="Choose another filter to see the rest of your log." />
          ) : (
            <div className="calendar-days">
              {days.slice(0, visibleDays).map(day => (
                <section key={day.date} className="calendar-day">
                  <header className="day-heading">
                    <span className="day-relative">{relativeDay(day.date)}</span>
                    <span className="day-full">{longDate(day.date)}</span>
                  </header>
                  <div className="day-events">
                    {day.events.map(event => (
                      <Card key={event.id} className="event-card" padding="sm">
                        <span className={`event-marker marker-${event.type}`}>
                          {EVENT_ICONS[event.type] ?? <CalendarIcon size={16} />}
                        </span>
                        <div className="event-body">
                          <span className="event-title">{event.title}</span>
                          <span className="event-desc">{event.description}</span>
                        </div>
                        <div className="event-aside">
                          {event.value && <span className="event-value">{event.value}</span>}
                          {event.time && <span className="event-clock">{event.time}</span>}
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {days.length > visibleDays && (
            <button className="btn btn-secondary calendar-more" onClick={() => setVisibleDays(visibleDays + PAGE_SIZE)}>
              Show earlier days ({days.length - visibleDays} more)
            </button>
          )}
        </>
      )}
    </div>
  );
}
