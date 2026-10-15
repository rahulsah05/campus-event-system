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

const categoryClass = (category) => {
  const key = String(category || '').toLowerCase();
  return `category-badge category-${key}`;
};

export default function EventTable({ events, loading, onEdit, onDelete }) {
  if (loading) {
    return (
      <div className="table-container">
        <div className="empty-state">
          <div className="spinner" />
          <h3>Loading campus events</h3>
          <p>Fetching records from Render API and MongoDB Atlas</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="table-container">
        <div className="empty-state">
          <div className="empty-state-icon">
            <CalendarOff size={32} />
          </div>
          <h3>No events on the calendar</h3>
          <p>Add a workshop, hackathon, or seminar to get started — or clear your search.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-container">
      <div className="table-toolbar">
        <h3>Event records</h3>
        <span className="table-count">
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="event-table">
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
                  <span className="event-id-badge">{event.eventId}</span>
                </td>
                <td className="event-title-cell">
                  {event.title}
                  {event.description ? (
                    <span className="event-desc">{event.description}</span>
                  ) : null}
                </td>
                <td>
                  <span className={categoryClass(event.category)}>{event.category}</span>
                </td>
                <td>{formatDate(event.date)}</td>
                <td>
                  <div className="cell-with-icon">
                    <MapPin size={14} />
                    <span>{event.venue}</span>
                  </div>
                </td>
                <td>
                  <div className="cell-with-icon">
                    <User size={14} />
                    <span>{event.organizer}</span>
                  </div>
                </td>
                <td>
                  <span className="capacity-pill">{event.capacity}</span>
                </td>
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
