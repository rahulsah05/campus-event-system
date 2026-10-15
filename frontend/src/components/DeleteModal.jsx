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
        <div className="modal-body" style={{ textAlign: 'center', paddingTop: '2rem', paddingBottom: '1.6rem' }}>
          <div className="delete-icon-wrap">
            <AlertTriangle size={30} />
          </div>

          <h3 className="modal-title" style={{ marginBottom: '0.5rem' }}>
            Delete this event?
          </h3>
          <p style={{ color: '#6d6685', fontSize: '0.92rem', marginBottom: '1.5rem' }}>
            <strong style={{ color: '#17132b' }}>{event.title}</strong> ({event.eventId}) will be
            permanently removed from MongoDB Atlas.
          </p>

          <div className="delete-actions">
            <button className="btn btn-secondary" onClick={onClose} disabled={deleting}>
              Keep event
            </button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                'Deleting...'
              ) : (
                <>
                  <Trash2 size={16} /> Delete event
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
