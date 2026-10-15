import React from 'react';
import { CalendarDays, Clock3, PlayCircle, CheckCircle2 } from 'lucide-react';

export default function EventStats({ stats }) {
  const total = stats?.totalEvents || 0;
  const upcoming = stats?.upcoming || 0;
  const ongoing = stats?.ongoing || 0;
  const completed = stats?.completed || 0;

  return (
    <div className="stats-grid">
      <div className="stat-card stat-total">
        <div>
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total events</div>
        </div>
        <div className="stat-icon">
          <CalendarDays size={22} />
        </div>
      </div>

      <div className="stat-card stat-upcoming">
        <div>
          <div className="stat-value">{upcoming}</div>
          <div className="stat-label">Upcoming</div>
        </div>
        <div className="stat-icon">
          <Clock3 size={22} />
        </div>
      </div>

      <div className="stat-card stat-ongoing">
        <div>
          <div className="stat-value">{ongoing}</div>
          <div className="stat-label">Happening now</div>
        </div>
        <div className="stat-icon">
          <PlayCircle size={22} />
        </div>
      </div>

      <div className="stat-card stat-completed">
        <div>
          <div className="stat-value">{completed}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-icon">
          <CheckCircle2 size={22} />
        </div>
      </div>
    </div>
  );
}
