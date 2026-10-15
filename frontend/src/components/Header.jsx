import React from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';

export default function Header({ onRefresh, loading }) {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand">
          <div className="brand-icon">
            <CalendarDays size={24} />
          </div>
          <div>
            <span className="brand-title">Campus Event Hub</span>
            <span className="brand-subtitle">Workshops · Hackathons · Seminars · Campus Life</span>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh event records from database"
          >
            <RefreshCw size={16} className={loading ? 'is-spinning' : undefined} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
    </header>
  );
}
