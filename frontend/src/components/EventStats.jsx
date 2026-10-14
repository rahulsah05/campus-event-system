import React from 'react';
import { CalendarDays, Clock3, PlayCircle, CheckCircle2 } from 'lucide-react';

export default function EventStats({ stats }) {
  const total = stats?.totalEvents || 0;
  const upcoming = stats?.upcoming || 0;
  const ongoing = stats?.ongoing || 0;
  const completed = stats?.completed || 0;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div>
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total Events</div>
        </div>
        <div className="stat-icon">
          <CalendarDays size={24} />
        </div>
      </div>

      <div className="stat-card">
        <div>
          <div className="stat-value">{upcoming}</div>
          <div className="stat-label">Upcoming Events</div>
        </div>
        <div className="stat-icon" style={{ background: '#eef2ff', color: '#4f46e5' }}>
          <Clock3 size={24} />
        </div>
      </div>

      <div className="stat-card">
        <div>
          <div className="stat-value">{ongoing}</div>
          <div className="stat-label">Ongoing Events</div>
        </div>
        <div className="stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
          <PlayCircle size={24} />
        </div>
      </div>

      <div className="stat-card">
        <div>
          <div className="stat-value">{completed}</div>
          <div className="stat-label">Completed Events</div>
        </div>
        <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
          <CheckCircle2 size={24} />
        </div>
      </div>
    </div>
  );
}
