import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function Toast({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}
        >
          {toast.type === 'error' ? (
            <AlertCircle size={20} color="#e11d48" style={{ flexShrink: 0 }} />
          ) : (
            <CheckCircle2 size={20} color="#0f9f8a" style={{ flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, wordBreak: 'break-word' }}>{toast.message}</div>
          <button className="toast-dismiss" onClick={() => onDismiss(toast.id)}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
