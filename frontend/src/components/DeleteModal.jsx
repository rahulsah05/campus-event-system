import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

export default function DeleteModal({ isOpen, onClose, onConfirm, event }) {
  const [deleting, setDeleting] = useState(false);

  if (!isOpen || !event) return null;

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await onConfirm(event.eventId);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: 'center', paddingTop: '2rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem'
            }}
          >
            <AlertTriangle size={32} />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            Delete Event Record?
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Are you sure you want to delete event{' '}
            <strong style={{ color: '#0f172a' }}>{event.title}</strong> (ID: {event.eventId})?
            This will permanently remove the record from MongoDB Atlas.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={deleting}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                'Deleting...'
              ) : (
                <>
                  <Trash2 size={16} /> Delete Event
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
