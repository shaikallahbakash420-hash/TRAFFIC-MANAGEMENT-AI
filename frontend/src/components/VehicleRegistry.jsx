import React, { useState, useEffect } from 'react';
import { Search, ShieldAlert, AlertTriangle, FileText, Download } from 'lucide-react';

const API_BASE = 'http://localhost:5001/api';

export default function VehicleRegistry({ selectedCity }) {
  const [vehicles, setVehicles] = useState([]);
  const [flaggedVehicles, setFlaggedVehicles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedFuel, setSelectedFuel] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      // Query parameters
      let queryUrl = `${API_BASE}/vehicles?page=${page}&limit=12&cityId=${selectedCity}`;
      if (searchTerm) queryUrl += `&q=${searchTerm}`;
      if (selectedType) queryUrl += `&type=${selectedType}`;
      if (selectedFuel) queryUrl += `&fuel=${selectedFuel}`;

      const res = await fetch(queryUrl);
      const data = await res.json();
      setVehicles(data.data);
      setTotalPages(data.totalPages);

      // Fetch flagged database alerts for active city
      const flaggedRes = await fetch(`${API_BASE}/vehicles/flagged?cityId=${selectedCity}`);
      const flaggedData = await flaggedRes.json();
      setFlaggedVehicles(flaggedData);
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to sync vehicle logs:', error);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [selectedCity, page, searchTerm, selectedType, selectedFuel]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleTypeChange = (e) => {
    setSelectedType(e.target.value);
    setPage(1);
  };

  const handleFuelChange = (e) => {
    setSelectedFuel(e.target.value);
    setPage(1);
  };

  const exportRegistryCSV = () => {
    if (vehicles.length === 0) return;
    
    let csv = "Registration Number,Owner,Vehicle Type,Fuel Type,Last Seen Intersection,Last Seen Time,Status,Flag Reason\n";
    vehicles.forEach(v => {
      csv += `${v.regNumber},"${v.owner}",${v.type},${v.fuelType},"${v.lastSeenCameraName}",${v.lastSeenTime},${v.flagged ? 'FLAGGED' : 'CLEARED'},${v.flagReason}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `vehicles_${selectedCity}_registry.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 1. Main Search Registry Grid */}
      <div className="card lg:col-span-2 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><FileText size={18} /> ANPR Camera Database</h2>
          
          <button 
            className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition"
            onClick={exportRegistryCSV}
          >
            <Download size={12} /> Export Current Page
          </button>
        </div>

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <input 
              type="text" 
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 py-2 pl-9 pr-3 rounded-lg outline-none text-xs focus:border-blue-500" 
              placeholder="Search plate or owner..." 
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <Search size={14} className="absolute left-3 top-3 text-slate-500" />
          </div>

          <select 
            className="bg-slate-800 border border-slate-700 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs cursor-pointer focus:border-blue-500"
            value={selectedType} 
            onChange={handleTypeChange}
          >
            <option value="">All Vehicles</option>
            <option value="Car">Cars</option>
            <option value="Two-Wheeler">Two-Wheelers</option>
            <option value="Auto-Rickshaw">Auto-Rickshaws</option>
            <option value="Bus">Buses</option>
            <option value="Truck">Trucks</option>
          </select>

          <select 
            className="bg-slate-800 border border-slate-700 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs cursor-pointer focus:border-blue-500"
            value={selectedFuel} 
            onChange={handleFuelChange}
          >
            <option value="">All Fuel Types</option>
            <option value="Petrol">Petrol</option>
            <option value="Diesel">Diesel</option>
            <option value="CNG">CNG</option>
            <option value="EV">EV</option>
          </select>
        </div>

        {/* Table list */}
        {loading ? (
          <div className="py-20 text-center text-slate-400">Syncing database registries...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Reg Number</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Fuel</th>
                  <th className="py-3 px-4">Last Intersection</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-10 text-center text-slate-500">No records found.</td>
                  </tr>
                ) : (
                  vehicles.map(v => (
                    <tr key={v.regNumber} className="border-b border-slate-850 hover:bg-slate-800/10">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-200">{v.regNumber}</td>
                      <td className="py-3.5 px-4 text-slate-300">{v.owner}</td>
                      <td className="py-3.5 px-4 text-slate-400">{v.type}</td>
                      <td className="py-3.5 px-4">
                        <span className={`font-semibold ${v.fuelType === 'EV' ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {v.fuelType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 max-w-[150px] truncate">{v.lastSeenCameraName || 'En route'}</td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(v.lastSeenTime).toLocaleTimeString()}
                      </td>
                      <td className="py-3.5 px-4">
                        {v.flagged ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-1 w-fit">
                            <AlertTriangle size={10} /> Alert
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 w-fit">
                            Clear
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center border-t border-slate-800 pt-5 mt-4">
                <button 
                  className="bg-slate-800 border border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40" 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
                <button 
                  className="bg-slate-800 border border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40" 
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Hot-list Enforcement Sidebar */}
      <div className="card bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col h-fit">
        <h2 className="text-base font-bold text-red-500 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
          <ShieldAlert size={18} /> RTO Enforcement Hotline
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          Vehicles matching blacklists or document irregularities detected by traffic intersections in this city sector today.
        </p>

        <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1.5">
          {flaggedVehicles.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No flagged vehicle alerts in this sector.
            </div>
          ) : (
            flaggedVehicles.map(fv => (
              <div 
                key={fv.regNumber}
                className="p-3 bg-red-950/5 border border-red-500/10 rounded-xl"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono font-bold text-xs text-red-400">
                    {fv.regNumber}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-500/10 border border-red-500/20 text-red-500 uppercase tracking-wide">
                    {fv.flagReason.replace('_', ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-y-1 text-[10px] text-slate-400">
                  <span className="text-slate-500 font-medium">Owner:</span>
                  <span className="col-span-2 text-slate-300">{fv.owner}</span>
                  
                  <span className="text-slate-500 font-medium">Class:</span>
                  <span className="col-span-2 text-slate-300">{fv.type} ({fv.fuelType})</span>

                  <span className="text-slate-500 font-medium">Intersection:</span>
                  <span className="col-span-2 text-slate-300 leading-none">{fv.lastSeenCameraName}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
