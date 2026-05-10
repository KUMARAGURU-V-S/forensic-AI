import { useState, useMemo, useEffect } from 'react';
import { useForensicStore } from '../lib/store';
import EvidenceBoard from '../components/chronograph/EvidenceBoard';
import ChronoScrubber from '../components/chronograph/ChronoScrubber';
import DossierPanel from '../components/chronograph/DossierPanel';
import '../components/chronograph/Chronograph.css';
import { Clock, Shield, Search, Info } from 'lucide-react';

export default function ChronographPage() {
  const { chronographData, caseId } = useForensicStore();
  
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);

  // Default mock data if no real data is available yet
  const data = useMemo(() => {
    if (chronographData && chronographData.entities && chronographData.entities.length > 0) {
      return chronographData;
    }
    return { entities: [], connections: [] };
  }, [chronographData]);

  const timestamps = useMemo(() => {
    const times = [
      ...data.entities.map(e => new Date(e.timestamp).getTime()),
      ...data.connections.map(c => new Date(c.timestamp).getTime())
    ].filter(t => !isNaN(t)).sort((a, b) => a - b);
    return times;
  }, [data]);

  const startTime = timestamps[0] || Date.now() - 3600000;
  const endTime = timestamps[timestamps.length - 1] || Date.now();

  useEffect(() => {
    if (timestamps.length > 0 && currentTime === 0) {
      setCurrentTime(timestamps[0]);
    }
  }, [timestamps, currentTime]);

  const filteredEntities = useMemo(() => {
    return data.entities.filter(
      (e) => new Date(e.timestamp).getTime() <= currentTime
    );
  }, [data.entities, currentTime]);

  const filteredConnections = useMemo(() => {
    return data.connections.filter(
      (c) => new Date(c.timestamp).getTime() <= currentTime
    );
  }, [data.connections, currentTime]);

  const selectedEntity = useMemo(() => {
    return data.entities.find((e) => e.id === selectedEntityId) || null;
  }, [data.entities, selectedEntityId]);

  const selectedConnection = useMemo(() => {
    return data.connections.find((c) => c.id === selectedConnectionId) || null;
  }, [data.connections, selectedConnectionId]);

  const formatTime = (time) => {
    return new Date(time).toLocaleString();
  };

  if (data.entities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 font-mono">
        <Info size={48} className="mb-4 opacity-20" />
        <div className="text-sm">No chronograph data available for this case.</div>
        <div className="text-[10px] mt-2 text-slate-600">Run the "Agents" investigation to generate 4D visual intelligence.</div>
      </div>
    );
  }

  return (
    <div className="chronograph-container h-full flex flex-col bg-[#050a16]">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#070d1c]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Clock className="text-cyan-400" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">4D CHRONOGRAPH</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Shield size={10} className="text-slate-500" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Investigation: {caseId}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <Search size={12} className="text-slate-500" />
              <input type="text" placeholder="Search entities..." className="bg-transparent border-none text-[11px] text-white focus:outline-none w-32" />
           </div>
           <div className="text-[11px] font-mono text-cyan-400/80 bg-cyan-400/5 px-2 py-1 rounded border border-cyan-400/10">
              {filteredEntities.length} NODES | {filteredConnections.length} EDGES
           </div>
        </div>
      </header>

      <main className="flex-1 flex min-h-0 relative">
        <div className="flex-1 min-w-0">
          <EvidenceBoard
            entities={filteredEntities}
            connections={filteredConnections}
            onSelectNode={setSelectedEntityId}
            onSelectEdge={setSelectedConnectionId}
          />
        </div>
        <aside className="w-80 border-l border-white/5 bg-[#070d1c]/40 backdrop-blur-sm overflow-y-auto">
          <DossierPanel
            selectedEntity={selectedEntity}
            selectedConnection={selectedConnection}
          />
        </aside>
      </main>

      <footer className="px-6 py-6 border-t border-white/5 bg-[#070d1c]/80 backdrop-blur-md">
        <ChronoScrubber
          min={startTime}
          max={endTime}
          value={currentTime}
          onChange={setCurrentTime}
          formatTime={formatTime}
          marks={timestamps}
        />
      </footer>
    </div>
  );
}
