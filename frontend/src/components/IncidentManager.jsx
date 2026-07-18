import React, { useState, useEffect } from 'react';
import { AlertTriangle, Plus, CheckCircle2, AlertCircle } from 'lucide-react';

const API_BASE = 'http://localhost:5001/api';

export default function IncidentManager({ selectedCity, onIncidentReported }) {
  const [incidents, setIncidents] = useState([]);
  const [roads, setRoads] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [roadId, setRoadId] = useState('');
  const [type, setType] = useState('accident');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchIncidents = async () => {
    try {
      const incRes = await fetch(`${API_BASE}/incidents?cityId=${selectedCity}`);
      const incData = await incRes.json();
      setIncidents(incData);

      const roadRes = await fetch(`${API_BASE}/roads?cityId=${selectedCity}`);
      const roadData = await roadRes.json();
      setRoads(roadData);
      if (roadData.length > 0 && !roadId) {
        setRoadId(roadData[0].id);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to sync incidents list:', error);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [selectedCity]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roadId || !description) return;
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityId: selectedCity,
          roadId,
          type,
          description,
          severity
        })
      });

      if (res.ok) {
        setDescription('');
        fetchIncidents();
        if (onIncidentReported) onIncidentReported(); // Trigger parent KPI re-count
      }
    } catch (error) {
      console.error('Failed to submit new incident report:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (incidentId) => {
    try {
      const res = await fetch(`${API_BASE}/incidents/${incidentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' })
      });
      if (res.ok) {
        fetchIncidents();
        if (onIncidentReported) onIncidentReported();
      }
    } catch (error) {
      console.error('Failed to resolve incident ticket:', error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 1. Report new incident form */}
      <div className="card bg-slate-900/60 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2"><Plus size={18} /> Report Traffic Incident</h2>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          Log accidents, mechanical breakdowns, waterlogging, or VIP convoy holds. This immediately flags road speed delays.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="form-group flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Roadway Segment</label>
            <select 
              className="bg-slate-800 border border-slate-700 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs cursor-pointer focus:border-blue-500"
              value={roadId}
              onChange={(e) => setRoadId(e.target.value)}
              required
            >
              {roads.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Incident Category</label>
              <select 
                className="bg-slate-800 border border-slate-700 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs cursor-pointer focus:border-blue-500" 
                value={type} 
                onChange={(e) => setType(e.target.value)}
              >
                <option value="accident">Accident Collision</option>
                <option value="breakdown">Vehicle Breakdown</option>
                <option value="waterlogging">Waterlogging</option>
                <option value="vip_movement">VIP Dignitary Hold</option>
                <option value="roadworks">Road Maintenance</option>
              </select>
            </div>

            <div className="form-group flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Severity Level</label>
              <select 
                className="bg-slate-800 border border-slate-700 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs cursor-pointer focus:border-blue-500" 
                value={severity} 
                onChange={(e) => setSeverity(e.target.value)}
              >
                <option value="low">Low (Minor Delay)</option>
                <option value="medium">Medium (Lanes Throttled)</option>
                <option value="high">High (Full Road Closure)</option>
              </select>
            </div>
          </div>

          <div className="form-group flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Incident Details</label>
            <textarea 
              className="bg-slate-800 border border-slate-700 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs focus:border-blue-500" 
              rows="3" 
              placeholder="e.g. Broken axle truck blocking center lane of Outer Ring Road..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              style={{ resize: 'vertical' }}
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg text-xs font-bold transition cursor-pointer mt-4" 
            disabled={submitting}
          >
            {submitting ? 'Broadcasting Alert...' : 'Broadcast Traffic Alert'}
          </button>
        </form>
      </div>

      {/* 2. Active Incidents Log list */}
      <div className="card lg:col-span-2 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col">
        <h2 className="text-base font-bold text-red-500 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
          <AlertTriangle size={18} /> Open Command Incidents
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          Active incident tickets on road networks currently causing localized delays.
        </p>

        {loading ? (
          <div className="py-10 text-center text-slate-500">Loading incidents...</div>
        ) : (
          <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1.5">
            {incidents.filter(inc => inc.status !== 'resolved').length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-400 mb-3 animate-bounce" />
                <p>No active incidents flagged in this city sector.</p>
              </div>
            ) : (
              incidents.filter(inc => inc.status !== 'resolved').map(inc => (
                <div 
                  key={inc.id}
                  className="p-4 bg-slate-950/20 border border-slate-800 rounded-xl flex flex-col gap-2.5"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${inc.severity === 'high' ? 'bg-red-500/10 border border-red-500/20 text-red-500' : inc.severity === 'medium' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'}`}>
                      {inc.severity.toUpperCase()} Severity
                    </span>
                    <span className="font-bold text-slate-500 text-[10px]">
                      {inc.type.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-200 mb-1">{inc.road_name}</h4>
                    <p className="text-xs text-slate-400 leading-normal">{inc.description}</p>
                  </div>
                  
                  <div className="border-t border-slate-850 pt-3 mt-1.5 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500">
                      Reported: {new Date(inc.reported_time).toLocaleTimeString()}
                    </span>

                    <button 
                      className="border border-emerald-500/35 hover:bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded text-[10px] font-bold cursor-pointer transition"
                      onClick={() => handleResolve(inc.id)}
                    >
                      Resolve Incident
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
