import React, { useState, useEffect } from 'react';
import { X, Save, CalendarPlus } from 'lucide-react';

const CATEGORIES = ['Workshop', 'Hackathon', 'Seminar', 'Competition', 'Cultural'];
const STATUSES = ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'];

const toDateInputValue = (value) => {
  if (!value) return '';
  const iso = typeof value === 'string' ? value : new Date(value).toISOString();
  return iso.slice(0, 10);
};

export default function EventModal({ isOpen, onClose, onSave, eventToEdit }) {
  const isEditing = Boolean(eventToEdit);

  const initialFormState = {
    eventId: '',
    title: '',
    description: '',
    category: 'Workshop',
    date: '',
    venue: '',
    organizer: '',
    capacity: 50,
    status: 'Upcoming'
  };

  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (eventToEdit) {
      setFormData({
        eventId: eventToEdit.eventId || '',
        title: eventToEdit.title || '',
        description: eventToEdit.description || '',
        category: eventToEdit.category || 'Workshop',
        date: toDateInputValue(eventToEdit.date),
        venue: eventToEdit.venue || '',
        organizer: eventToEdit.organizer || '',
        capacity: eventToEdit.capacity || 50,
        status: eventToEdit.status || 'Upcoming'
      });
    } else {
      setFormData(initialFormState);
    }
    setError('');
  }, [eventToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'capacity' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.eventId.trim()) {
      setError('Event ID is required (e.g. EVT101).');
      return;
    }
    if (!formData.title.trim()) {
      setError('Event title is required.');
      return;
    }
    if (!formData.date) {
      setError('Event date is required.');
      return;
    }
    if (!formData.venue.trim()) {
      setError('Venue is required.');
      return;
    }
    if (!formData.organizer.trim()) {
      setError('Organizer is required.');
      return;
    }
    if (!formData.capacity || Number(formData.capacity) < 1) {
      setError('Capacity must be at least 1.');
      return;
    }

    try {
      setSubmitting(true);
      await onSave(formData, isEditing);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save event details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {isEditing ? `Edit Event: ${formData.eventId}` : 'Add New Event'}
          </h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  fontSize: '0.875rem'
                }}
              >
                {error}
              </div>
            )}

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">
                  Event ID <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="eventId"
                  className="form-control"
                  placeholder="e.g. EVT101"
                  value={formData.eventId}
                  onChange={handleChange}
                  disabled={isEditing}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Date <span className="required">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  className="form-control"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group col-span-2">
                <label className="form-label">
                  Event Title <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  className="form-control"
                  placeholder="e.g. Algorand Developer Workshop"
                  value={formData.title}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group col-span-2">
                <label className="form-label">Description</label>
                <textarea
                  name="description"
                  className="form-control"
                  rows="3"
                  placeholder="Optional short description of the event"
                  value={formData.description}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Category <span className="required">*</span>
                </label>
                <select
                  name="category"
                  className="form-control"
                  value={formData.category}
                  onChange={handleChange}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Status <span className="required">*</span>
                </label>
                <select
                  name="status"
                  className="form-control"
                  value={formData.status}
                  onChange={handleChange}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Venue <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="venue"
                  className="form-control"
                  placeholder="e.g. Seminar Hall 1"
                  value={formData.venue}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Organizer <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="organizer"
                  className="form-control"
                  placeholder="e.g. Department of Computer Science"
                  value={formData.organizer}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group col-span-2">
                <label className="form-label">
                  Capacity <span className="required">*</span>
                </label>
                <input
                  type="number"
                  name="capacity"
                  className="form-control"
                  min="1"
                  placeholder="e.g. 100"
                  value={formData.capacity}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                'Saving...'
              ) : isEditing ? (
                <>
                  <Save size={16} /> Update Event
                </>
              ) : (
                <>
                  <CalendarPlus size={16} /> Add Event
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
