import React from 'react';
import { Edit2, Trash2, CalendarOff, MapPin, User } from 'lucide-react';

const formatDate = (value) => {
  if (!value) return '—';
  const iso = typeof value === 'string' ? value : new Date(value).toISOString();
  const [year, month, day] = iso.slice(0, 10).split('-');
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });
};

const statusClass = (status) => {
  const key = String(status || '').toLowerCase();
  if (key === 'upcoming') return 'status-badge status-upcoming';
  if (key === 'ongoing') return 'status-badge status-ongoing';
  if (key === 'completed') return 'status-badge status-completed';
  if (key === 'cancelled') return 'status-badge status-cancelled';
  return 'status-badge';
};

export default function EventTable({ events, loading, onEdit, onDelete }) {
  if (loading) {
    return (
      <div className="table-container">
        <div className="empty-state">
          <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>Loading event records...</div>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Fetching data from Render API &amp; MongoDB Atlas
          </p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="table-container">
        <div className="empty-state">
          <div className="empty-state-icon">
            <CalendarOff size={48} />
          </div>
          <h3>No Event Records Found</h3>
          <p>Click "Add Event" to create your first record, or clear your search filter.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-container">
      <div style={{ overflowX: 'auto' }}>
        <table className="student-table event-table">
          <thead>
            <tr>
              <th>Event ID</th>
              <th>Title</th>
              <th>Category</th>
              <th>Date</th>
              <th>Venue</th>
              <th>Organizer</th>
              <th>Capacity</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event._id || event.eventId}>
                <td>
                  <span className="student-id-badge">{event.eventId}</span>
                </td>
                <td style={{ fontWeight: 600, color: '#0f172a' }}>{event.title}</td>
                <td>{event.category}</td>
                <td>{formatDate(event.date)}</td>
                <td style={{ color: '#475569' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={14} color="#94a3b8" />
                    <span>{event.venue}</span>
                  </div>
                </td>
                <td style={{ color: '#475569' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <User size={14} color="#94a3b8" />
                    <span>{event.organizer}</span>
                  </div>
                </td>
                <td>{event.capacity}</td>
                <td>
                  <span className={statusClass(event.status)}>{event.status}</span>
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn-icon edit"
                      onClick={() => onEdit(event)}
                      title="Edit Event Details"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="btn-icon delete"
                      onClick={() => onDelete(event)}
                      title="Delete Event Record"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
