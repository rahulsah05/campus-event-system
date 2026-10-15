import React from 'react';
import { Globe, Server, Database } from 'lucide-react';
import { eventAPI } from '../services/api';

export default function ArchitectureBanner({ backendHealthy, checkingHealth }) {
  const apiUrl = eventAPI.getBaseUrl();

  return (
    <div className="tiers-banner">
      <div className="tier-card">
        <div className="tier-icon-wrap tier-netlify">
          <Globe size={20} />
        </div>
        <div className="tier-info">
          <h4>Tier 1 · Presentation</h4>
          <div className="tier-name">
            Netlify <span className="status-dot online" title="Frontend is active"></span>
          </div>
          <span className="tier-caption">React SPA client</span>
        </div>
      </div>

      <div className="tier-card">
        <div className="tier-icon-wrap tier-render">
          <Server size={20} />
        </div>
        <div className="tier-info">
          <h4>Tier 2 · Application</h4>
          <div className="tier-name">
            Render
            <span
              className={`status-dot ${backendHealthy ? 'online' : 'offline'}`}
              title={backendHealthy ? 'Backend API connected' : 'Backend API unreachable'}
            ></span>
          </div>
          <span className="tier-caption">
            {checkingHealth ? 'Checking health...' : apiUrl}
          </span>
        </div>
      </div>

      <div className="tier-card">
        <div className="tier-icon-wrap tier-mongo">
          <Database size={20} />
        </div>
        <div className="tier-info">
          <h4>Tier 3 · Database</h4>
          <div className="tier-name">
            MongoDB Atlas
            <span
              className={`status-dot ${backendHealthy ? 'online' : 'offline'}`}
              title={backendHealthy ? 'Database connected via Backend' : 'Waiting for connection'}
            ></span>
          </div>
          <span className="tier-caption">events collection</span>
        </div>
      </div>
    </div>
  );
}
