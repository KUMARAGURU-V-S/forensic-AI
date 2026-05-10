import React, { useEffect, useRef } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import type { Entity, Connection } from './types';

interface EvidenceBoardProps {
  entities: Entity[];
  connections: Connection[];
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
}

const EvidenceBoard: React.FC<EvidenceBoardProps> = ({ entities, connections, onSelectNode, onSelectEdge }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesDataSet = useRef(new DataSet<any>([]));
  const edgesDataSet = useRef(new DataSet<any>([]));

  useEffect(() => {
    if (!containerRef.current) return;

    const data = { 
      nodes: nodesDataSet.current, 
      edges: edgesDataSet.current 
    };

    const options = {
      nodes: {
        size: 20,
        font: {
          color: '#ffffff',
          size: 14,
        },
        borderWidth: 2,
        shadow: true,
      },
      edges: {
        width: 2,
        color: { color: '#ff4444', highlight: '#ffffff' },
        font: { color: '#aaaaaa', strokeWidth: 0, align: 'middle' },
        arrows: { to: { enabled: true, scaleFactor: 0.5 } },
        smooth: {
          type: 'continuous',
        }
      },
      groups: {
        person: { 
          shape: 'diamond',
          color: { background: '#1a73e8', border: '#174ea6' } 
        },
        location: { 
          shape: 'square',
          color: { background: '#34a853', border: '#1e8e3e' } 
        },
        evidence: { 
          shape: 'triangle',
          color: { background: '#fbbc04', border: '#f29900' } 
        },
        event: {
          shape: 'star',
          color: { background: '#ea4335', border: '#c5221f' }
        }
      },
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.01,
          springLength: 100,
          springConstant: 0.08,
          avoidOverlap: 1,
        },
        stabilization: {
          enabled: true,
          iterations: 1000,
          updateInterval: 100,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
      }
    };

    networkRef.current = new Network(containerRef.current, data, options as any);

    networkRef.current.on('selectNode', (params) => {
      onSelectNode(params.nodes[0] || null);
      onSelectEdge(null);
    });

    networkRef.current.on('selectEdge', (params) => {
      onSelectEdge(params.edges[0] || null);
      onSelectNode(null);
    });

    networkRef.current.on('deselectNode', () => onSelectNode(null));
    networkRef.current.on('deselectEdge', () => onSelectEdge(null));

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, []); // Initialize once

  useEffect(() => {
    // Sync nodes
    const currentNodes = nodesDataSet.current.get();
    const newNodeIds = new Set(entities.map(e => e.id));

    // Remove nodes not in filtered list
    const nodesToRemove = currentNodes
      .filter((n: any) => !newNodeIds.has(n.id))
      .map((n: any) => n.id);
    if (nodesToRemove.length > 0) {
      nodesDataSet.current.remove(nodesToRemove);
    }

    // Add or update nodes
    const nodesToUpdate = entities.map(e => ({
      id: e.id,
      label: e.label,
      group: e.type,
    }));
    nodesDataSet.current.update(nodesToUpdate);

    // Sync edges
    const currentEdges = edgesDataSet.current.get();
    const newEdgeIds = new Set(connections.map(c => c.id));

    // Remove edges not in filtered list
    const edgesToRemove = currentEdges
      .filter((e: any) => !newEdgeIds.has(e.id))
      .map((e: any) => e.id);
    if (edgesToRemove.length > 0) {
      edgesDataSet.current.remove(edgesToRemove);
    }

    // Add or update edges
    const edgesToUpdate = connections.map(c => ({
      id: c.id,
      from: c.from,
      to: c.to,
      label: c.label,
    }));
    edgesDataSet.current.update(edgesToUpdate);

    // If new elements were added, we might want to trigger a small stabilization
    if (networkRef.current) {
      networkRef.current.startSimulation();
    }
  }, [entities, connections]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default EvidenceBoard;
