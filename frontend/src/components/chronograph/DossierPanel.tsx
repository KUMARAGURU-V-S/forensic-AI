import React from 'react';
import { FileText, MapPin, User, Link as LinkIcon } from 'lucide-react';
import type { Entity, Connection } from './types';

interface DossierPanelProps {
  selectedEntity: Entity | null;
  selectedConnection: Connection | null;
}

const DossierPanel: React.FC<DossierPanelProps> = ({ selectedEntity, selectedConnection }) => {
  if (!selectedEntity && !selectedConnection) {
    return (
      <div className="dossier-panel empty">
        <p>Select an entity or connection to view the raw evidence file.</p>
      </div>
    );
  }

  return (
    <div className="dossier-panel">
      {selectedEntity && (
        <>
          <div className="dossier-header">
            {selectedEntity.type === 'person' && <User size={20} />}
            {selectedEntity.type === 'location' && <MapPin size={20} />}
            {selectedEntity.type === 'evidence' && <FileText size={20} />}
            <h2>{selectedEntity.label}</h2>
          </div>
          <div className="dossier-content">
            <div className="metadata">
              <label>ID:</label> <span>{selectedEntity.id}</span>
              <label>Type:</label> <span>{selectedEntity.type}</span>
              <label>Discovered:</label> <span>{new Date(selectedEntity.timestamp).toLocaleString()}</span>
            </div>
            <div className="raw-doc">
              <h3>Raw Evidence Transcript</h3>
              <p>{selectedEntity.details}</p>
            </div>
          </div>
        </>
      )}

      {selectedConnection && (
        <>
          <div className="dossier-header">
            <LinkIcon size={20} />
            <h2>{selectedConnection.label}</h2>
          </div>
          <div className="dossier-content">
            <div className="metadata">
              <label>Connection ID:</label> <span>{selectedConnection.id}</span>
              <label>Occurred:</label> <span>{new Date(selectedConnection.timestamp).toLocaleString()}</span>
            </div>
            <div className="raw-doc">
              <h3>Investigation Note</h3>
              <p>{selectedConnection.details}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DossierPanel;
