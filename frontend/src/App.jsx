import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  Activity, 
  Map, 
  Database, 
  Navigation, 
  BarChart3, 
  AlertTriangle, 
  Radio, 
  ShieldAlert,
  Download
} from 'lucide-react';
import TrafficMap from './components/TrafficMap';
import SignalController from './components/SignalController';
import VehicleRegistry from './components/VehicleRegistry';
import AnalyticsPanel from './components/AnalyticsPanel';
import CitizenPortal from './components/CitizenPortal';
import IncidentManager from './components/IncidentManager';

const API_BASE = 'http://localhost:5001/api';

function App() {
  const [currentView, setCurrentView] = useState('control_room');
  const [selectedCity, setSelectedCity] = useState('bengaluru');
  const [cities, setCities] = useState([]);
  
  // Real-time states synchronized via Socket.io
  const [roads, setRoads] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [signals, setSignals] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [logs, setLogs] = useState([]);
  
  const [loading, setLoading] = useState(true);

  // 1. Initial REST API load for cities list
  const fetchCities = async () => {
    try {
      const res = await fetch(`${API_BASE}/cities`);
      const data = await res.json();
      setCities(data);
    } catch (error) {
      console.error('Failed to query cities registry:', error);
    }
  };

  // 2. Establish Socket.io connection for real-time telemetry updates
  useEffect(() => {
    fetchCities();
    
    console.log('Connecting to WebSocket server on http://localhost:5001');
    const socket = io('http://localhost:5001');

    socket.on('connect', () => {
      console.log('Successfully connected to Traffic AI WebSocket pipeline.');
    });

    socket.on('traffic_update', (data) => {
      // Data format: { roads, cameras, signals, incidents, logs }
      setRoads(data.roads);
      setCameras(data.cameras);
      setSignals(data.signals);
      setIncidents(data.incidents);
      setLogs(data.logs);
      setLoading(false);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket pipeline.');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Filter metrics based on selected city on the client
  const cityRoads = roads.filter(r => r.cityId === selectedCity);
  const cityIncidents = incidents.filter(i => i.cityId === selectedCity && i.status !== 'resolved');
  
  // Compute aggregate stats dynamically from real-time database-driven states
  const avgCongestion = cityRoads.length > 0 
    ? Math.round(cityRoads.reduce((sum, r) => sum + r.congestionPercent, 0) / cityRoads.length)
    : 0;

  const avgAqi = cityRoads.length > 0
    ? Math.round(cityRoads.reduce((sum, r) => sum + r.aqi, 0) / cityRoads.length)
    : 0;

  const activeIncidentsCount = cityIncidents.length;

  const activeCity = cities.find(c => c.id === selectedCity) || {
    name: selectedCity.charAt(0).toUpperCase() + selectedCity.slice(1),
    totalVehicles: 5000
  };

  const handleExportData = () => {
    // CSV export containing live snapshot database metrics
    let csv = "Metric,Value\n";
    csv += `City,${activeCity.name}\n`;
    csv += `Average Congestion %,${avgCongestion}%\n`;
    csv += `Average Local AQI,${avgAqi}\n`;
    csv += `Active Incidents,${activeIncidentsCount}\n`;
    csv += `Telemetry Timestamp,${new Date().toISOString()}\n\n`;

    csv += "Road ID,Road Name,Congestion %,Speed (km/h),Vehicles Count,AQI\n";
    cityRoads.forEach(r => {
      csv += `${r.id},"${r.name}",${r.congestionPercent},${r.avgSpeed},${r.vehicleCount},${r.aqi}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${selectedCity}_live_traffic_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="app-container flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Tricolor stripe at the top */}
      <div className="tricolor-stripe flex fixed top-0 left-0 w-full h-1 z-[1000]">
        <div className="stripe-saffron flex-1 bg-[#ff9933]"></div>
        <div className="stripe-white flex-1 bg-white"></div>
        <div className="stripe-green flex-1 bg-[#138808]"></div>
      </div>

      {/* Sidebar Navigation */}
      <aside className="sidebar w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col fixed h-full top-0 left-0 z-50">
        <div className="sidebar-brand flex items-center gap-3 pb-6 mb-8 border-b border-slate-800">
          <Activity size={24} className="text-red-500 animate-pulse" />
          <span className="sidebar-logo font-bold text-lg tracking-wider bg-gradient-to-r from-orange-400 via-white to-green-500 bg-clip-text text-transparent">
            TRAFFIC.AI INDIA
          </span>
        </div>

        <nav className="sidebar-menu flex flex-col gap-1.5 flex-grow">
          <button 
            className={`sidebar-item flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 cursor-pointer transition ${currentView === 'control_room' ? 'active bg-blue-500/10 text-white border-l-4 border-blue-500' : ''}`}
            onClick={() => setCurrentView('control_room')}
          >
            <Radio size={18} />
            Control Room
          </button>
          <button 
            className={`sidebar-item flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 cursor-pointer transition ${currentView === 'signals' ? 'active bg-blue-500/10 text-white border-l-4 border-blue-500' : ''}`}
            onClick={() => setCurrentView('signals')}
          >
            <ShieldAlert size={18} />
            Signal Overrides
          </button>
          <button 
            className={`sidebar-item flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 cursor-pointer transition ${currentView === 'registry' ? 'active bg-blue-500/10 text-white border-l-4 border-blue-500' : ''}`}
            onClick={() => setCurrentView('registry')}
          >
            <Database size={18} />
            Vehicle Registry
          </button>
          <button 
            className={`sidebar-item flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 cursor-pointer transition ${currentView === 'commute' ? 'active bg-blue-500/10 text-white border-l-4 border-blue-500' : ''}`}
            onClick={() => setCurrentView('commute')}
          >
            <Navigation size={18} />
            Citizen Commute
          </button>
          <button 
            className={`sidebar-item flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 cursor-pointer transition ${currentView === 'analytics' ? 'active bg-blue-500/10 text-white border-l-4 border-blue-500' : ''}`}
            onClick={() => setCurrentView('analytics')}
          >
            <BarChart3 size={18} />
            Analytics & AI
          </button>
          <button 
            className={`sidebar-item flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 cursor-pointer transition ${currentView === 'incidents' ? 'active bg-blue-500/10 text-white border-l-4 border-blue-500' : ''}`}
            onClick={() => setCurrentView('incidents')}
          >
            <AlertTriangle size={18} />
            Report Incident
          </button>
        </nav>

        {/* City Selector & Export */}
        <div className="sidebar-footer pt-4 border-t border-slate-800 flex flex-col gap-4">
          <div className="city-select-wrapper flex flex-col gap-1.5">
            <span className="city-select-label text-xs font-bold text-slate-500 uppercase tracking-widest">Command Center</span>
            <select 
              className="city-select w-full bg-slate-800 border border-slate-700 text-slate-200 py-2 px-3 rounded-lg outline-none cursor-pointer text-sm focus:border-blue-500"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
            >
              {cities.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          
          <button 
            className="btn btn-secondary w-full flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white py-2 rounded-lg text-sm transition font-medium"
            onClick={handleExportData}
          >
            <Download size={14} />
            Export Live Data
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="main-content flex-1 pl-64 p-8 pt-10 min-h-screen">
        <header className="page-header flex justify-between items-center mb-8">
          <div>
            <h1 className="page-title text-2xl font-bold font-display tracking-tight text-white">
              {currentView === 'control_room' && 'Live Traffic Operations Center'}
              {currentView === 'signals' && 'Smart Signal Override Deck'}
              {currentView === 'registry' && 'National Vehicle Registry Search'}
              {currentView === 'commute' && 'Citizen Commuter Portal'}
              {currentView === 'analytics' && 'Congestion Analytics & AI Forecasting'}
              {currentView === 'incidents' && 'Incident & Emergency Reporting Console'}
            </h1>
            <p className="page-subtitle text-sm text-slate-400 mt-1">
              Monitoring {activeCity.name} Sector • WebSockets Simulation Active (5s ticks)
            </p>
          </div>
          <div className="badge flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <Radio size={12} className="animate-pulse text-red-500" /> WebSocket Live
          </div>
        </header>

        {/* Dynamic Summary Cards */}
        <section className="kpi-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card bg-slate-900/60 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
            <div>
              <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-1">Avg Congestion</h3>
              <div 
                className="kpi-value text-2xl font-bold font-display"
                style={{ color: avgCongestion > 70 ? 'var(--traffic-red)' : avgCongestion > 35 ? 'var(--traffic-yellow)' : 'var(--traffic-green)' }}
              >
                {avgCongestion}%
              </div>
            </div>
            <div className="kpi-icon-wrapper w-12 h-12 rounded-xl flex items-center justify-center bg-orange-500/10 text-[#ff9933]">
              <Activity size={20} />
            </div>
          </div>

          <div className="card bg-slate-900/60 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
            <div>
              <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-1">Sector AQI</h3>
              <div 
                className="kpi-value text-2xl font-bold font-display"
                style={{ color: avgAqi > 200 ? 'var(--traffic-red)' : avgAqi > 100 ? 'var(--traffic-yellow)' : 'var(--traffic-green)' }}
              >
                {avgAqi}
              </div>
            </div>
            <div className="kpi-icon-wrapper w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 text-white">
              <ShieldAlert size={20} />
            </div>
          </div>

          <div className="card bg-slate-900/60 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
            <div>
              <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-1">Active Signals</h3>
              <div className="kpi-value text-2xl font-bold font-display text-emerald-400">
                {signals.filter(s => s.cityId === selectedCity).length}
              </div>
            </div>
            <div className="kpi-icon-wrapper w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-400">
              <Database size={20} />
            </div>
          </div>

          <div className="card bg-slate-900/60 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
            <div>
              <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-1">Active Incidents</h3>
              <div 
                className="kpi-value text-2xl font-bold font-display"
                style={{ color: activeIncidentsCount > 0 ? 'var(--traffic-red)' : 'var(--text-main)' }}
              >
                {activeIncidentsCount}
              </div>
            </div>
            <div className="kpi-icon-wrapper w-12 h-12 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500">
              <AlertTriangle size={20} />
            </div>
          </div>
        </section>

        {/* View Routing */}
        {loading ? (
          <div className="card bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
            Synchronizing command center feeds...
          </div>
        ) : (
          <>
            {currentView === 'control_room' && (
              <div className="dashboard-grid grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Interactive Map */}
                <div className="card lg:col-span-2 bg-slate-900/60 border border-slate-800 p-0 rounded-2xl overflow-hidden shadow-xl">
                  <TrafficMap 
                    selectedCity={selectedCity} 
                    liveRoads={roads.filter(r => r.cityId === selectedCity)}
                    liveCameras={cameras.filter(c => c.cityId === selectedCity)}
                    liveSignals={signals.filter(s => s.cityId === selectedCity)}
                  />
                </div>
                
                {/* Sidebar Alerts */}
                <div className="flex flex-col gap-6">
                  <div className="card bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl flex-1 flex flex-col">
                    <h2 className="card-title text-base font-bold text-white flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                      <Radio size={16} className="text-red-500" /> Operational Feed
                    </h2>
                    <div className="log-list flex flex-col gap-2.5 overflow-y-auto max-h-[360px] pr-1.5 flex-1">
                      {logs.filter(l => l.cityId === selectedCity).length === 0 ? (
                        <p className="text-slate-500 text-xs text-center my-auto">No traffic alerts in this city sector.</p>
                      ) : (
                        logs.filter(l => l.cityId === selectedCity).map((log, idx) => (
                          <div key={idx} className={`log-item p-3 bg-slate-950/40 rounded-lg border-l-4 text-xs ${log.type === 'violation' ? 'border-red-500' : log.type === 'adaptive_extension' ? 'border-amber-500' : log.type === 'emergency_corridor' ? 'border-emerald-500' : 'border-blue-500'}`}>
                            <div className="log-time text-[10px] text-slate-500 mb-1">{new Date(log.timestamp).toLocaleTimeString()}</div>
                            <div className="text-slate-300">{log.message}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  <div className="card bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl">
                    <h2 className="card-title text-base font-bold text-white flex items-center gap-2 mb-3">
                      <ShieldAlert size={16} className="text-blue-400" /> Fast Dispatch
                    </h2>
                    <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                      Lock emergency priority lanes or configure overrides on signal timings.
                    </p>
                    <button 
                      className="btn w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold transition"
                      onClick={() => setCurrentView('signals')}
                    >
                      Open Override Console
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentView === 'signals' && (
              <SignalController selectedCity={selectedCity} />
            )}

            {currentView === 'registry' && (
              <VehicleRegistry selectedCity={selectedCity} />
            )}

            {currentView === 'commute' && (
              <CitizenPortal selectedCity={selectedCity} />
            )}

            {currentView === 'analytics' && (
              <AnalyticsPanel selectedCity={selectedCity} />
            )}

            {currentView === 'incidents' && (
              <IncidentManager selectedCity={selectedCity} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
