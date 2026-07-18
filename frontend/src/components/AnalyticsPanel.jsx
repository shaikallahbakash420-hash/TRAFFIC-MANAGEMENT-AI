import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3, Clock, TrendingUp, AlertTriangle, Zap, CheckCircle2 } from 'lucide-react';

const API_BASE = 'http://localhost:5001/api';

export default function AnalyticsPanel({ selectedCity }) {
  const [trendData, setTrendData] = useState([]);
  const [advisory, setAdvisory] = useState({ bestTimes: [], worstTimes: [], currentRecommendation: '' });
  const [roads, setRoads] = useState([]);
  const [selectedRoadId, setSelectedRoadId] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);

  const fetchAnalyticsData = async () => {
    try {
      // 1. Fetch trend data
      const trendRes = await fetch(`${API_BASE}/analytics/trends?cityId=${selectedCity}`);
      const trendJson = await trendRes.json();
      setTrendData(trendJson);

      // 2. Fetch travel advisory
      const adviceRes = await fetch(`${API_BASE}/analytics/best-times?cityId=${selectedCity}`);
      const adviceJson = await adviceRes.json();
      setAdvisory(adviceJson);

      // 3. Fetch roads to populate dropdown
      const roadRes = await fetch(`${API_BASE}/roads?cityId=${selectedCity}`);
      const roadJson = await roadRes.json();
      setRoads(roadJson);
      if (roadJson.length > 0 && !selectedRoadId) {
        setSelectedRoadId(roadJson[0].id);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to sync analytics logs:', error);
    }
  };

  const getPrediction = async () => {
    if (!selectedRoadId) return;
    setPredicting(true);
    try {
      const res = await fetch(`${API_BASE}/analytics/prediction?roadId=${selectedRoadId}`);
      const data = await res.json();
      setPrediction(data);
    } catch (error) {
      console.error('Failed to fetch AI route forecast:', error);
    } finally {
      setPredicting(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedCity]);

  useEffect(() => {
    if (selectedRoadId) {
      getPrediction();
    }
  }, [selectedRoadId, selectedCity]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 1. Time-series Congestion Trend Chart */}
      <div className="card lg:col-span-2 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2"><BarChart3 size={18} /> 24-Hour Congestion & AQI Profiler</h2>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          Dynamic trends compiled from database logs tracking morning rush hours (8:30-10:00 AM) and evening rush hours (6:30-8:30 PM).
        </p>

        {loading ? (
          <div className="h-72 flex items-center justify-center text-slate-400">Compiling charts...</div>
        ) : (
          <div className="w-full h-80 bg-slate-950/20 border border-slate-850 p-3 rounded-xl">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCongestion" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--saffron)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--saffron)" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorAqi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="hour" stroke="var(--text-muted)" style={{ fontSize: '10px' }} />
                <YAxis stroke="var(--text-muted)" style={{ fontSize: '10px' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '11px'
                  }} 
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" name="Congestion %" dataKey="congestion" stroke="var(--saffron)" fillOpacity={1} fill="url(#colorCongestion)" strokeWidth={2} />
                <Area type="monotone" name="AQI" dataKey="aqi" stroke="var(--color-primary)" fillOpacity={1} fill="url(#colorAqi)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 2. Congestion Prediction and Travel Advisory Widgets */}
      <div className="flex flex-col gap-6">
        
        {/* Next Hour Forecast */}
        <div className="card bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-2"><TrendingUp size={18} /> Predictive Route Forecast</h2>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Select a roadway to run the AI prediction loop for the upcoming hour.
          </p>

          <div className="form-group mb-4 flex flex-col gap-1.5">
            <select 
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs cursor-pointer focus:border-blue-500" 
              value={selectedRoadId} 
              onChange={(e) => setSelectedRoadId(e.target.value)}
            >
              {roads.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {predicting || !prediction ? (
            <div className="text-slate-500 text-xs py-4">Running SQL models...</div>
          ) : (
            <div className="flex flex-col gap-3 text-xs">
              <div className="flex justify-between border-b border-slate-850 pb-2">
                <span className="text-slate-500">Current Congestion:</span>
                <span className="font-bold text-slate-200">{prediction.currentCongestion}%</span>
              </div>
              
              <div className="flex justify-between border-b border-slate-850 pb-2">
                <span className="text-slate-500">Next-Hour ({prediction.forecastTime}):</span>
                <span 
                  className="font-bold" 
                  style={{ 
                    color: prediction.predictedCongestion > 70 ? 'var(--traffic-red)' : prediction.predictedCongestion > 35 ? 'var(--traffic-yellow)' : 'var(--traffic-green)' 
                  }}
                >
                  {prediction.predictedCongestion}%
                </span>
              </div>

              <div className="flex justify-between border-b border-slate-850 pb-2">
                <span className="text-slate-500">Forecast Status:</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${prediction.predictedLevel === 'red' ? 'bg-red-500/10 text-red-500' : prediction.predictedLevel === 'yellow' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  {prediction.predictedLevel === 'red' ? 'Heavy Grid' : prediction.predictedLevel === 'yellow' ? 'Moderate' : 'Free Flow'}
                </span>
              </div>

              <div className="flex justify-between border-b border-slate-850 pb-2">
                <span className="text-slate-500">Est. Speed:</span>
                <span className="font-bold text-blue-400">{prediction.predictedSpeed} km/h</span>
              </div>

              <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850 text-[10px] text-slate-400 leading-normal mt-1">
                <span className="font-bold text-slate-300 block mb-1"><Zap size={10} className="inline mr-1" /> SQL ML Model</span>
                {prediction.modelName}
              </div>
            </div>
          )}
        </div>

        {/* Best time to travel */}
        <div className="card bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4"><Clock size={16} /> Commute Adviser</h2>
          
          <div className="flex flex-col gap-5 text-xs">
            <div>
              <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider flex items-center gap-1 mb-2">
                <CheckCircle2 size={12} /> Optimal Departure Hours
              </span>
              <div className="flex gap-2.5">
                {advisory.bestTimes.map((t, idx) => (
                  <div key={idx} className="flex-1 p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-center">
                    <div className="font-bold text-slate-200">{t.time}</div>
                    <div className="text-[10px] text-slate-500">{t.congestion}% Cong.</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-red-500 uppercase font-bold tracking-wider flex items-center gap-1 mb-2">
                <AlertTriangle size={12} /> Hours to Avoid
              </span>
              <div className="flex gap-2.5">
                {advisory.worstTimes.map((t, idx) => (
                  <div key={idx} className="flex-1 p-2 bg-red-500/5 border border-red-500/10 rounded-lg text-center">
                    <div className="font-bold text-red-400">{t.time}</div>
                    <div className="text-[10px] text-slate-500">{t.congestion}% Cong.</div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 border-t border-slate-850 pt-3">
              <strong>Advisory:</strong> {advisory.currentRecommendation}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
