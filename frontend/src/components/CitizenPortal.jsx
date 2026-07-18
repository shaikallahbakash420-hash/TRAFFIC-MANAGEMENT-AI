import React, { useState, useEffect } from 'react';
import { Navigation, Clock, ShieldAlert, Sparkles, Wind, Eye } from 'lucide-react';

const API_BASE = 'http://localhost:5001/api';

export default function CitizenPortal({ selectedCity }) {
  const [roads, setRoads] = useState([]);
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [routeReport, setRouteReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRoads = async () => {
    try {
      const res = await fetch(`${API_BASE}/roads?cityId=${selectedCity}`);
      const data = await res.json();
      setRoads(data);
      if (data.length > 1) {
        setOriginId(data[0].id);
        setDestinationId(data[1].id);
      }
      setLoading(false);
      setRouteReport(null); // Clear previous routes
    } catch (error) {
      console.error('Failed to sync roads for citizen commute:', error);
    }
  };

  useEffect(() => {
    fetchRoads();
  }, [selectedCity]);

  const handleRouteQuery = (e) => {
    e.preventDefault();
    if (!originId || !destinationId) return;

    const originRoad = roads.find(r => r.id === originId);
    const destRoad = roads.find(r => r.id === destinationId);

    if (!originRoad || !destRoad) return;

    // Calculations based on database states
    const avgCongestion = Math.round((originRoad.congestionPercent + destRoad.congestionPercent) / 2);
    const avgAqi = Math.round((originRoad.aqi + destRoad.aqi) / 2);
    
    const standardTime = 12; // Base minutes
    const delayTime = Math.round((avgCongestion / 100) * 30);
    const totalTime = standardTime + delayTime;

    const altCongestion = Math.max(15, Math.round(avgCongestion * 0.45));
    const altTime = standardTime + Math.round((altCongestion / 100) * 12);
    const timeSaved = totalTime - altTime;

    setRouteReport({
      origin: originRoad.name,
      destination: destRoad.name,
      travelTime: totalTime,
      congestion: avgCongestion,
      aqi: avgAqi,
      primaryRouteName: `Via ${originRoad.name.split(' (')[0]} and Central Link`,
      alternateRouteName: `Via Outer Ring Expressway Bypass`,
      alternateTime: altTime,
      alternateCongestion: altCongestion,
      timeSaved: Math.max(2, timeSaved)
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 1. Trip planner form */}
      <div className="card bg-slate-900/60 border border-blue-500/20 p-6 rounded-2xl shadow-xl">
        <h2 className="text-lg font-bold text-[#ff9933] flex items-center gap-2 mb-2"><Navigation size={18} /> Check Traffic Before You Leave</h2>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          Avoid traffic hotspots and high-pollution areas. Check live route data.
        </p>

        {loading ? (
          <div className="py-10 text-center text-slate-500">Loading routes...</div>
        ) : (
          <form onSubmit={handleRouteQuery} className="flex flex-col gap-4">
            <div className="form-group flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Starting Point (Origin)</label>
              <select 
                className="bg-slate-800 border border-slate-700 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs cursor-pointer focus:border-blue-500"
                value={originId}
                onChange={(e) => setOriginId(e.target.value)}
              >
                {roads.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Destination</label>
              <select 
                className="bg-slate-800 border border-slate-700 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs cursor-pointer focus:border-blue-500"
                value={destinationId}
                onChange={(e) => setDestinationId(e.target.value)}
              >
                {roads.map(r => (
                  <option key={r.id} value={r.id} disabled={r.id === originId}>{r.name}</option>
                ))}
              </select>
            </div>

            <button 
              type="submit" 
              className="w-full bg-[#ff9933] hover:bg-[#e67e22] text-white py-2.5 rounded-lg text-xs font-bold transition cursor-pointer mt-4"
            >
              Find Fast Route
            </button>
          </form>
        )}
      </div>

      {/* 2. Dynamic Route Report Card */}
      <div className="card lg:col-span-2 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col h-fit">
        <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4 border-b border-slate-800 pb-3"><Clock size={16} /> Commute Optimization Report</h2>
        
        {!routeReport ? (
          <div className="my-auto py-16 text-center text-slate-500">
            <Navigation size={32} className="mx-auto mb-3 opacity-40 text-blue-500" />
            <p className="text-xs">Specify your commute route on the left to map speeds and emission overlays.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 text-xs">
            {/* Primary Route Summary */}
            <div className="p-5 bg-slate-950/40 border border-slate-850 rounded-xl flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Standard Path</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${routeReport.congestion > 70 ? 'bg-red-500/10 text-red-500 border border-red-500/20' : routeReport.congestion > 35 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                  {routeReport.congestion}% Congestion
                </span>
              </div>
              
              <h3 className="text-sm font-bold text-slate-200">{routeReport.primaryRouteName}</h3>
              
              <div className="flex gap-6 mt-2">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-orange-400" />
                  <div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Est. Duration</div>
                    <span className="font-bold text-sm text-slate-200">{routeReport.travelTime} Mins</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Wind size={16} className={routeReport.aqi > 200 ? 'text-red-500' : 'text-emerald-400'} />
                  <div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">AQI Index</div>
                    <span className="font-bold text-sm text-slate-200">{routeReport.aqi}</span>
                  </div>
                </div>
              </div>

              {routeReport.aqi > 200 && (
                <div className="mt-2 bg-red-500/15 border border-red-500/20 p-3 rounded-lg flex gap-2 text-red-400 text-xs">
                  <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
                  <span><strong>High Emission Warning:</strong> Mask recommended for open two-wheelers. Maintain closed AC circulation in cabins due to localized exhaust build-ups.</span>
                </div>
              )}
            </div>

            {/* Alternative Route Recommendation */}
            <div className="border border-emerald-500/20 bg-emerald-500/5 p-4 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-wider">
                  <Sparkles size={10} className="inline mr-1" /> Recommended Bypass Path
                </span>
                <span className="font-bold text-emerald-400">
                  Save {routeReport.timeSaved} Mins
                </span>
              </div>
              
              <h4 className="text-xs font-bold text-slate-200">{routeReport.alternateRouteName}</h4>
              
              <div className="grid grid-cols-2 gap-4 mt-3 text-[11px]">
                <div>
                  <span className="text-slate-500">Duration:</span>
                  <span className="ml-1.5 font-bold text-slate-300">{routeReport.alternateTime} Mins</span>
                </div>
                <div>
                  <span className="text-slate-500">Congestion:</span>
                  <span className="ml-1.5 font-bold text-emerald-400">{routeReport.alternateCongestion}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
