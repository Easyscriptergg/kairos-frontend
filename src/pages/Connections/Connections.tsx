import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useKairos } from '../../data/store/KairosStore';
import { Card, StatusBadge, PageHeader, Notice } from '../../components/shared/SharedComponents';
import { PlugZap } from 'lucide-react';
import './Connections.css';

export default function Connections() {
  const { state } = useKairos();
  const navigate = useNavigate();
  const { connections } = state;

  return (
    <div className="page connections-page">
      <PageHeader
        title="Connections"
        subtitle="Wearables and apps Kairos is designed to import from"
      />

      <Notice
        icon={<PlugZap size={20} />}
        title="Provider connections are not available yet"
        tone="accent"
        action={<button className="btn btn-secondary" onClick={() => navigate('/recover')}>Log a check-in</button>}
      >
        Connecting a provider needs an authorization and import service on the Kairos backend, which has not been built.
        Nothing on this page is connected, and no figure elsewhere in the app comes from a wearable. Until then, log sleep,
        heart-rate and training data by hand.
      </Notice>

      <div className="connections-grid">
        {connections.map(conn => (
          <Card key={conn.id} className="conn-card">
            <div className="conn-card-header">
              <div className="conn-identity">
                <span className="icon-tile" aria-hidden="true">{conn.icon}</span>
                <h3 className="conn-name">{conn.name}</h3>
              </div>
              <StatusBadge status="Not connected" variant="neutral" />
            </div>

            <div className="conn-streams">
              <span className="streams-label">Planned data</span>
              <div className="streams-chips">
                {conn.availableDataTypes.map(stream => (
                  <span key={stream} className="domain-tag">
                    {stream.replace(/-/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            <button className="btn btn-secondary" disabled title="Provider authorization has not been built yet">
              Connect — not available yet
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
