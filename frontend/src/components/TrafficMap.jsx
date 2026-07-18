import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Camera, MapPin, Eye, Wind, Activity, AlertCircle } from 'lucide-react';

const cityCenters = {
  delhi: [28.6139, 77.2090],
  mumbai: [19.0760, 72.8777],
  bengaluru: [12.9716, 77.5946],
  pune: [18.5204, 73.8567],
  hyderabad: [17.3850, 78.4867]
};

export default function TrafficMap({ selectedCity, liveRoads, liveCameras, liveSignals }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({ roads: [], cameras: [], signals: [], aqi: [] });
  
  const [selectedElement, setSelectedElement] = useState(null); // { type: 'road'|'camera'|'signal', id: ... }
  const [showAqiOverlay, setShowAqiOverlay] = useState(false);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapInstanceRef.current && mapContainerRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: cityCenters[selectedCity] || cityCenters.bengaluru,
        zoom: 13,
        zoomControl: false
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      // Dark style tile layers
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      mapInstanceRef.current = map;
    }
  }, []);

  // 2. Fly to City Center
  useEffect(() => {
    if (mapInstanceRef.current) {
      const center = cityCenters[selectedCity] || cityCenters.bengaluru;
      mapInstanceRef.current.flyTo(center, 13, { duration: 1.2 });
      setSelectedElement(null);
    }
  }, [selectedCity]);

  // 3. Render Layers on Data Changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old layers
    layersRef.current.roads.forEach(layer => map.removeLayer(layer));
    layersRef.current.cameras.forEach(layer => map.removeLayer(layer));
    layersRef.current.signals.forEach(layer => map.removeLayer(layer));
    layersRef.current.aqi.forEach(layer => map.removeLayer(layer));

    layersRef.current.roads = [];
    layersRef.current.cameras = [];
    layersRef.current.signals = [];
    layersRef.current.aqi = [];

    // --- RENDER ROADS ---
    liveRoads.forEach(road => {
      const color = road.congestionLevel === 'red' ? 'var(--traffic-red)' : road.congestionLevel === 'yellow' ? 'var(--traffic-yellow)' : 'var(--traffic-green)';
      
      const line = L.polyline(road.polyline, {
        color: color,
        weight: 6,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      line.bindTooltip(`<strong>${road.name}</strong><br/>Speed: ${road.avgSpeed} km/h • Congestion: ${road.congestionPercent}%`, {
        className: 'road-tooltip',
        sticky: true
      });

      line.on('click', () => {
        setSelectedElement({ type: 'road', id: road.id });
      });

      layersRef.current.roads.push(line);

      // AQI Heat overlays
      if (showAqiOverlay) {
        const midIdx = Math.floor(road.polyline.length / 2);
        const midPoint = road.polyline[midIdx];
        
        let aqiColor = 'var(--traffic-green)';
        if (road.aqi > 250) aqiColor = 'var(--traffic-red)';
        else if (road.aqi > 150) aqiColor = 'var(--traffic-yellow)';

        const aqiBubble = L.circle(midPoint, {
          radius: 350,
          color: aqiColor,
          fillColor: aqiColor,
          fillOpacity: 0.15,
          weight: 1,
          dashArray: '4'
        }).addTo(map);

        layersRef.current.aqi.push(aqiBubble);
      }
    });

    // --- RENDER CAMERAS ---
    liveCameras.forEach(cam => {
      const camIcon = L.divIcon({
        className: 'custom-cam-marker',
        html: `<div style="background: var(--color-primary); width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.6);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker(cam.coordinate, { icon: camIcon }).addTo(map);
      marker.bindTooltip(`<strong>${cam.name}</strong><br/>Detections: ${cam.liveCount} vehicles`, { sticky: true });
      
      marker.on('click', () => {
        setSelectedElement({ type: 'camera', id: cam.id });
      });

      layersRef.current.cameras.push(marker);
    });

    // --- RENDER SIGNALS ---
    liveSignals.forEach(sig => {
      const sigIcon = L.divIcon({
        className: 'custom-sig-marker',
        html: `<div style="background: #090e18; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.5);"><div class="signal-dot ${sig.status}"></div></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = L.marker(sig.coordinate, { icon: sigIcon }).addTo(map);
      marker.bindTooltip(`<strong>${sig.junctionName}</strong><br/>Light: <span style="font-weight:bold; color: ${sig.status === 'RED' ? 'red' : 'green'}">${sig.status}</span><br/>Queue: ${sig.queueLength} vehicles`, { sticky: true });
      
      marker.on('click', () => {
        setSelectedElement({ type: 'signal', id: sig.id });
      });

      layersRef.current.signals.push(marker);
    });

  }, [liveRoads, liveCameras, liveSignals, showAqiOverlay]);

  // Find selected element from the active array to ensure updates reflect live
  let activeElement = null;
  if (selectedElement) {
    if (selectedElement.type === 'road') {
      activeElement = { type: 'road', data: liveRoads.find(r => r.id === selectedElement.id) };
    } else if (selectedElement.type === 'camera') {
      activeElement = { type: 'camera', data: liveCameras.find(c => c.id === selectedElement.id) };
    } else if (selectedElement.type === 'signal') {
      activeElement = { type: 'signal', data: liveSignals.find(s => s.id === selectedElement.id) };
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-4 bg-slate-900/40">
      {/* Map display */}
      <div className="lg:col-span-3 relative rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
        <div ref={mapContainerRef} style={{ height: '480px', width: '100%' }} />
        
        {/* Map Toggles overlay */}
        <div className="absolute bottom-5 left-5 bg-slate-950/90 p-4 rounded-xl border border-slate-800 flex flex-col gap-2.5 z-[1000] text-[11px] shadow-2xl">
          <span className="font-bold text-slate-400">Command Controls</span>
          <button 
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-left cursor-pointer transition font-medium ${showAqiOverlay ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
            onClick={() => setShowAqiOverlay(!showAqiOverlay)}
          >
            <Wind size={12} />
            {showAqiOverlay ? 'Hide AQI Overlay' : 'Show AQI Overlay'}
          </button>
          
          <div className="h-px bg-slate-800 my-1"></div>
          
          <div className="flex items-center gap-2">
            <span className="w-6 h-1 rounded bg-[#10b981]"></span>
            <span>Free Flow (&lt;35%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-1 rounded bg-[#f59e0b]"></span>
            <span>Moderate (35-70%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-1 rounded bg-[#ef4444]"></span>
            <span>Heavy Grid (&gt;70%)</span>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 flex flex-col justify-start h-[480px] overflow-y-auto">
        {!activeElement ? (
          <div className="my-auto text-center text-slate-500">
            <MapPin size={32} className="mx-auto mb-3 opacity-40 text-blue-500" />
            <p className="text-xs">Select any road, camera, or traffic signal on the map to stream telemetry.</p>
          </div>
        ) : activeElement.type === 'road' ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-bold text-orange-400 flex items-center gap-2 border-b border-slate-800 pb-2"><MapPin size={16} /> Road Segment</h2>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Street Name</span>
              <p className="font-bold text-white text-sm">{activeElement.data.name}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Speed</span>
                <p className="text-lg font-bold text-blue-400">{activeElement.data.avgSpeed} <span className="text-xs text-slate-500">km/h</span></p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Density</span>
                <p className="text-lg font-bold text-slate-200">{activeElement.data.vehicleCount} <span className="text-xs text-slate-500">v/km</span></p>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Congestion Ratio</span>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex-grow h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${activeElement.data.congestionPercent}%`, 
                      backgroundColor: activeElement.data.congestionLevel === 'red' ? 'var(--traffic-red)' : activeElement.data.congestionLevel === 'yellow' ? 'var(--traffic-yellow)' : 'var(--traffic-green)'
                    }}
                  ></div>
                </div>
                <span className="font-bold text-sm text-slate-200">{activeElement.data.congestionPercent}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-3">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Air Quality (AQI)</span>
                <p className="text-base font-bold text-[#ff9933]">{activeElement.data.aqi}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Status</span>
                <div className="mt-0.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${activeElement.data.congestionLevel === 'red' ? 'bg-red-500/10 border border-red-500/20 text-red-500' : activeElement.data.congestionLevel === 'yellow' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'}`}>
                    {activeElement.data.congestionLevel.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {activeElement.data.incidentIds.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex gap-2 text-xs text-red-400 mt-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Incident Blockage</div>
                  <span className="text-[10px] text-slate-400">Speeds throttled due to road obstruction logs.</span>
                </div>
              </div>
            )}
          </div>
        ) : activeElement.type === 'camera' ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-blue-400 flex items-center gap-2 border-b border-slate-800 pb-2"><Camera size={16} /> ANPR Camera</h2>
            
            {/* Live mockup stream */}
            <div className="relative h-32 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
              <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse z-10">
                LIVE FEED
              </span>
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="opacity-70 bg-slate-950">
                <path d="M 0 50 L 100 50" stroke="#475569" strokeWidth="0.5" strokeDasharray="2,2" />
                <rect x="20" y="25" width="10" height="6" fill="var(--saffron)">
                  <animate attributeName="x" from="-10" to="110" dur="3s" repeatCount="indefinite" />
                </rect>
                <rect x="70" y="65" width="12" height="7" fill="var(--color-primary)">
                  <animate attributeName="x" from="110" to="-10" dur="4.5s" repeatCount="indefinite" />
                </rect>
              </svg>
              <span className="absolute bottom-2 right-2 bg-slate-950/80 px-1.5 py-0.5 rounded font-mono text-[9px] text-slate-400">
                {new Date().toLocaleTimeString()}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Node Name</span>
              <p className="font-bold text-white text-xs leading-tight">{activeElement.data.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Vehicles Count</span>
                <p className="text-base font-bold text-emerald-400">{activeElement.data.liveCount}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Speed Limit</span>
                <p className="text-base font-bold text-slate-200">{activeElement.data.speedLimit} km/h</p>
              </div>
            </div>

            {activeElement.data.lastViolation && (
              <div className="border-t border-slate-800 pt-3">
                <span className="text-[10px] text-red-500 uppercase font-bold tracking-wider">Last violation alert</span>
                <div className="mt-1 bg-red-950/20 border border-red-500/20 p-2.5 rounded-lg text-[11px]">
                  <div className="flex justify-between font-bold text-red-400 mb-1">
                    <span>{activeElement.data.lastViolation.type}</span>
                    <span className="font-mono">{activeElement.data.lastViolation.vehicleReg}</span>
                  </div>
                  <p className="text-slate-400 leading-tight">{activeElement.data.lastViolation.details}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          // SIGNAL ELEMENT
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-bold text-amber-500 flex items-center gap-2 border-b border-slate-800 pb-2"><Activity size={16} /> Signal Node</h2>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Junction Name</span>
              <p className="font-bold text-white text-sm">{activeElement.data.junctionName}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Light Phase</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-3 h-3 rounded-full signal-dot ${activeElement.data.status}`}></div>
                  <span className="font-bold text-slate-200">{activeElement.data.status}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Hold Timer</span>
                <p className="text-lg font-bold text-blue-400">{activeElement.data.waitTime} <span className="text-xs text-slate-500">s</span></p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-3">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Mode</span>
                <p className="text-xs font-semibold text-slate-300 mt-0.5">
                  {activeElement.data.activePriority ? 'PRIORITY' : activeElement.data.timingMode.toUpperCase()}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Queue</span>
                <p className="text-base font-bold text-slate-200">{activeElement.data.queueLength} vehicles</p>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Queue by Lane</span>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {Object.entries(activeElement.data.directionQueues || {}).map(([dir, val]) => (
                  <div key={dir} className="flex justify-between items-center bg-slate-900/40 border border-slate-800 px-2 py-1 rounded text-xs">
                    <span className="text-slate-500">{dir}</span>
                    <span className="font-bold text-slate-300">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
