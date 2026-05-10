export type NodeType = 'person' | 'location' | 'evidence' | 'event';

export interface Entity {
  id: string;
  label: string;
  type: NodeType;
  details: string;
  timestamp: string; // When it first appeared or was discovered
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  label: string;
  timestamp: string; // When the connection occurred
  details: string;
}

export interface InvestigationData {
  entities: Entity[];
  connections: Connection[];
}
