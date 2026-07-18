import React, { useState } from 'react';
import { ShieldAlert, Zap, AlertTriangle, Play, ShieldAlert as PriorityIcon, RotateCcw } from 'lucide-react';

const API_BASE = 'http://localhost:5001/api';

export default function SignalController({ selectedCity, liveSignals, liveRoads }) {
  // Emergency Corridor Form State
  const [emergencyType, setEmergencyType] = useState('Ambulance');
  const [emergencyPlate, setEmergencyPlate] = useState('');
  const [corridorRoadId, setCorridorRoadId] = useState(liveRoads[0]?.id || '');
  
  const [overrideLoading, setOverrideLoading] = useState(null); // stores signalId currently editing

  const corridorActive = liveSignals.some(s => s.activePriority);
  const overriddenSignalNames = liveSignals.filter(s => s.activePriority).map(s => s.junctionName);

  // Handle Signal Mode Toggle
  const toggleSignalMode = async (signalId, currentMode) => {
    const newMode = currentMode === 'adaptive' ? 'manual' : 'adaptive';
    setOverrideLoading(signalId);
    try {
      await fetch(`${API_BASE}/signals/${signalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timingMode: newMode })
      });
    } catch (error) {
      console.error('Failed to toggle signal control mode:', error);
    } finally {
      setOverrideLoading(null);
    }
  };

  // Handle Manual Light Override
  const overrideSignalStatus = async (signalId, newStatus) => {
    setOverrideLoading(signalId);
    try {
      await fetch(`${API_BASE}/signals/${signalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, waitTime: 30 }) // Hold for 30s
      });
    } catch (error) {
      console.error('Failed to apply manual light state:', error);
    } finally {
      setOverrideLoading(null);
    }
  };

  // Establish Corridor
  const handleEstablishCorridor = async (e) => {
    e.preventDefault();
    const targetRoad = corridorRoadId || (liveRoads[0]?.id);
    if (!targetRoad) return;

    const plate = emergencyPlate || (selectedCity === 'delhi' ? 'DL3CA' : selectedCity === 'bengaluru' ? 'KA51MB' : 'MH12AB') + Math.floor(1000 + Math.random() * 9000);

    try {
      await fetch(`${API_BASE}/incidents/emergency/corridor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityId: selectedCity,
          roadIds: [targetRoad],
          vehicleType: emergencyType,
          regNumber: plate
        })
      });
      setEmergencyPlate('');
    } catch (error) {
      console.error('Failed to trigger emergency corridor:', error);
    }
  };

  // Release Corridor
  const handleReleaseCorridor = async () => {
    try {
      await fetch(`${API_BASE}/incidents/emergency/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityId: selectedCity })
      });
    } catch (error) {
      console.error('Failed to release emergency corridor:', error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 1. Junction Management Deck */}
      <div className="card lg:col-span-2 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2"><ShieldAlert size={18} /> Signal Control Room</h2>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          Monitor signals. Toggle timing to Manual to override lights directly. Auto-extension triggers dynamically when queues exceed 25.
        </p>

        <div className="flex flex-col gap-4">
          {liveSignals.length === 0 ? (
            <div className="text-slate-500 text-xs py-10 text-center">No signals defined in this city sector.</div>
          ) : (
            liveSignals.map(sig => (
              <div 
                key={sig.id} 
                className={`p-5 border rounded-xl transition ${sig.activePriority ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-950/20 border-slate-800'}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">{sig.junctionName}</h3>
                    <div className="flex items-center gap-2.5 mt-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${sig.activePriority ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : sig.timingMode === 'adaptive' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {sig.activePriority ? 'EMERGENCY' : sig.timingMode}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Queue: <strong className="text-slate-300">{sig.queueLength}</strong> vehicles
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <div className={`w-3 h-3 rounded-full signal-dot ${sig.status}`}></div>
                      <span className="font-bold text-sm text-slate-200">{sig.status}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {sig.waitTime}s remaining
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-800/60 mt-4 pt-4 flex justify-between items-center">
                  <button 
                    className={`text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer font-medium ${overrideLoading === sig.id ? 'opacity-50' : ''}`}
                    onClick={() => toggleSignalMode(sig.id, sig.timingMode)}
                    disabled={sig.activePriority || overrideLoading === sig.id}
                  >
                    Switch to {sig.timingMode === 'adaptive' ? 'Manual' : 'Adaptive'}
                  </button>

                  <div className="flex gap-2">
                    {['RED', 'AMBER', 'GREEN'].map(phase => (
                      <button 
                        key={phase}
                        className={`px-3 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                          sig.status === phase 
                            ? (phase === 'RED' ? 'bg-red-500 text-white' : phase === 'GREEN' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white') 
                            : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                        disabled={sig.timingMode === 'adaptive' || sig.activePriority || overrideLoading === sig.id}
                        onClick={() => overrideSignalStatus(sig.id, phase === 'AMBER' ? 'AMBER' : phase)}
                      >
                        {phase.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Emergency Green Corridor Simulator */}
      <div className="flex flex-col gap-6">
        <div className={`card bg-slate-900/60 border p-5 rounded-2xl shadow-xl transition ${corridorActive ? 'border-emerald-500/30' : 'border-slate-800'}`}>
          <h2 className={`text-base font-bold flex items-center gap-2 mb-3 ${corridorActive ? 'text-emerald-400' : 'text-white'}`}>
            <Zap size={18} /> Green Corridor Deck
          </h2>
          
          {corridorActive ? (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <PriorityIcon size={16} className="animate-ping" />
                  PRIORITY CORRIDOR CLEARED
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Traffic signals on the selected segments are locked to Green to expedite vehicle clearance.
                </p>
                <div className="text-[10px] text-slate-500 mt-1 leading-normal">
                  Overridden: {overriddenSignalNames.join(', ')}
                </div>
              </div>

              <button 
                className="w-full bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer mt-2"
                onClick={handleReleaseCorridor}
              >
                <RotateCcw size={14} /> Release Corridor Control
              </button>
            </div>
          ) : (
            <form onSubmit={handleEstablishCorridor} className="flex flex-col gap-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Clear routes for dispatching ambulances (108) or fire brigades (101) quickly. Signals will align green automatically.
              </p>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Emergency Category</label>
                <select 
                  className="bg-slate-800 border border-slate-700 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs cursor-pointer focus:border-blue-500"
                  value={emergencyType}
                  onChange={(e) => setEmergencyType(e.target.value)}
                >
                  <option value="Ambulance">Ambulance (108 Response)</option>
                  <option value="Fire Brigade">Fire Brigade (101 Dispatch)</option>
                  <option value="VIP Convoy">VIP Convenor Route</option>
                  <option value="Police Pursuit">Police Response</option>
                </select>
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Registration Plate</label>
                <input 
                  type="text" 
                  className="bg-slate-800 border border-slate-700 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs focus:border-blue-500"
                  placeholder="e.g. KA51MB4321" 
                  value={emergencyPlate}
                  onChange={(e) => setEmergencyPlate(e.target.value)}
                />
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Clear Congestion Path</label>
                <select 
                  className="bg-slate-800 border border-slate-700 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs cursor-pointer focus:border-blue-500"
                  value={corridorRoadId}
                  onChange={(e) => setCorridorRoadId(e.target.value)}
                  required
                >
                  <option value="" disabled>Select Segment...</option>
                  {liveRoads.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <button 
                type="submit" 
                className="w-full bg-[#ff9933] hover:bg-[#e67e22] text-white py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <Play size={12} fill="white" /> Lock Corridor Green
              </button>
            </form>
          )}
        </div>

        <div className="card bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl text-xs text-slate-400 leading-relaxed">
          <h2 className="text-white font-bold mb-3 flex items-center gap-1.5"><AlertTriangle size={14} className="text-amber-500" /> Operational Guideline</h2>
          <ul className="list-disc pl-4 flex flex-col gap-2">
            <li>Manual overrides force signals to static phases indefinitely.</li>
            <li>Emergency corridor automatically restores normal timings 60 seconds after dispatch passes.</li>
            <li>Restricted side streets remain red while priority corridors are running.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
