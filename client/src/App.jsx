import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import globeLogo from './assets/Globe_Logo.jpg'; // Ensure this path is correct
import './App.css';

// --- LEAFLET ICON FIX ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// --- COMPONENT: LOADING SCREEN ---
function LoadingScreen() {
  return (
    <div className="loading-overlay">
      <div className="spinner-box">
        <div className="spinner-ripple"></div>
        <div className="spinner-ring"></div>
        <img src={globeLogo} alt="Loading..." className="loading-logo" />
      </div>
      <p className="loading-text">Reconciling Network Data...</p>
    </div>
  );
}

// --- HELPER: MAP RECENTER ---
function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (lat && lng) map.flyTo([lat, lng], 15);
  }, [lat, lng, map]);
  return null;
}

// --- COMPONENT: DASHBOARD (Now Interactive) ---
function Dashboard({ data, activeFilter, onFilterChange }) {
  if (!data || data.length === 0) return null;

  // Calculate counts based on your CSV Status strings
  const newSites = data.filter(r => r.Status === 'NEW SITE').length;
  const removed = data.filter(r => r.Status === 'REMOVED SITE').length;
  const mismatch = data.filter(r => r.Status === 'NAME MISMATCH').length;

  const chartData = [
    { name: 'New', value: newSites, color: '#28a745' },
    { name: 'Removed', value: removed, color: '#dc3545' },
    { name: 'Mismatch', value: mismatch, color: '#ffc107' }
  ].filter(item => item.value > 0);

  // Helper for Card Styles (Visual Feedback)
  const getCardStyle = (type, colorInfo) => {
    const isActive = activeFilter === type;
    return {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      border: isActive ? `2px solid ${colorInfo.border}` : '1px solid #eee',
      backgroundColor: isActive ? colorInfo.bg : 'white',
      transform: isActive ? 'scale(1.02)' : 'scale(1)',
      boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 5px rgba(0,0,0,0.05)'
    };
  };

  return (
    <div className="dashboard-container">
      {/* CHART SECTION */}
      <div className="chart-section">
        <h4 className="chart-title">Breakdown</h4>
        <div style={{ width: '100%', height: 130 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie 
                data={chartData} cx="50%" cy="50%" 
                innerRadius={35} outerRadius={55} 
                paddingAngle={5} dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* STATS CARDS - Clickable to Filter */}
      <div className="cards-section">
        
        {/* TOTAL - Resets to ALL */}
        <div 
          className="stat-card total"
          onClick={() => onFilterChange('ALL')}
          style={getCardStyle('ALL', { border: '#007bff', bg: '#f0f9ff' })}
        >
          <span className="stat-label">Total</span>
          <span className="stat-value">{data.length}</span>
        </div>

        {/* NEW - Filters to 'NEW SITE' */}
        <div 
          className="stat-card new"
          onClick={() => onFilterChange('NEW SITE')}
          style={getCardStyle('NEW SITE', { border: '#28a745', bg: '#eaffea' })}
        >
          <span className="stat-label">New</span>
          <span className="stat-value">{newSites}</span>
        </div>

        {/* REMOVED - Filters to 'REMOVED SITE' */}
        <div 
          className="stat-card removed"
          onClick={() => onFilterChange('REMOVED SITE')}
          style={getCardStyle('REMOVED SITE', { border: '#dc3545', bg: '#ffeaea' })}
        >
          <span className="stat-label">Removed</span>
          <span className="stat-value">{removed}</span>
        </div>

        {/* MISMATCH - Filters to 'NAME MISMATCH' */}
        <div 
          className="stat-card mismatch"
          onClick={() => onFilterChange('NAME MISMATCH')}
          style={getCardStyle('NAME MISMATCH', { border: '#ffc107', bg: '#fffbea' })}
        >
          <span className="stat-label">Mismatch</span>
          <span className="stat-value">{mismatch}</span>
        </div>

      </div>
    </div>
  );
}

// --- MAIN APP COMPONENT ---
function App() {
  const [monitorFile1, setMonitorFile1] = useState(null);
  const [monitorFile2, setMonitorFile2] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  
  // --- NEW: Filter State ---
  const [filterStatus, setFilterStatus] = useState('ALL'); // Default: Show All
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSite, setSelectedSite] = useState({ lat: 7.1905, lng: 125.4503 });
  const [showBigMap, setShowBigMap] = useState(false);

  // --- FILTERING LOGIC ---
  const filteredResults = results.filter(row => {
    // 1. Check Search Term
    const matchesSearch = 
      row.PLA_ID.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (row["NMS Name"] && row["NMS Name"].toLowerCase().includes(searchTerm.toLowerCase()));

    // 2. Check Status Filter (from Card Click)
    const matchesStatus = filterStatus === 'ALL' 
      ? true 
      : row.Status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const handleExport = () => {
    if (results.length === 0) {
      alert("No data to export. Please run a scan first.");
      return;
    }
    const headers = ["PLA_ID", "Status", "NMS Name", "UDM Name", "Latitude", "Longitude"];
    const rows = filteredResults.map(row => [ // Export ONLY what is currently visible/filtered
      row.PLA_ID,
      row.Status,
      `"${row["NMS Name"] || ""}"`, 
      `"${row["UDM Name"] || ""}"`,
      row.Lat,
      row.Lng
    ].join(","));
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `network_report_${filterStatus.toLowerCase().replace(' ', '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleScan = async () => {
    if (!monitorFile1 || !monitorFile2) {
      alert("Please upload both CSV files.");
      return;
    }
    setIsLoading(true);
    setResults([]);
    setFilterStatus('ALL'); // Reset filter on new scan

    try {
      const text1 = await readFileAsText(monitorFile1);
      const text2 = await readFileAsText(monitorFile2);

      setTimeout(() => {
        // CHECK IF RUNNING IN APPS SCRIPT OR LOCAL MOCK
        if (window.google && window.google.script) {
           window.google.script.run
             .withSuccessHandler((resRaw) => {
               const res = JSON.parse(resRaw);
               if (res.success) {
                 setResults(res.data);
                 if (res.count === 0) alert("Match! No discrepancies found.");
               } else {
                 alert("Error: " + res.error);
               }
               setIsLoading(false);
             })
             .withFailureHandler((err) => {
               alert("Connection Failed: " + err);
               setIsLoading(false);
             })
             .processCSVComparison(text1, text2);
        } else {
           // --- LOCAL DEV MODE MOCK DATA (For testing without Apps Script) ---
           console.log("Local Mode: Generating Mock Data");
           const mockData = [
             { PLA_ID: "DVO_0172", Status: "NAME MISMATCH", "NMS Name": "Site_A_Old", "UDM Name": "Site_A_New", Lat: 7.17085, Lng: 125.41559 },
             { PLA_ID: "DVO_0177", Status: "NEW SITE", "NMS Name": "", "UDM Name": "Site_B_New", Lat: 7.01811, Lng: 125.61018 },
             { PLA_ID: "DVO_0179", Status: "REMOVED SITE", "NMS Name": "Site_C_Old", "UDM Name": "", Lat: 7.30454, Lng: 125.43193 },
             { PLA_ID: "DVO_0203", Status: "NAME MISMATCH", "NMS Name": "Site_D_Old", "UDM Name": "Site_D_New", Lat: 7.20092, Lng: 125.54526 },
           ];
           // Generate more mock data to fill table
           for(let i=0; i<50; i++) {
             mockData.push({ 
               PLA_ID: `DVO_TEST_${i}`, 
               Status: i % 3 === 0 ? "NEW SITE" : "NAME MISMATCH", 
               "NMS Name": `Site_${i}_Old`, 
               "UDM Name": `Site_${i}_New`, 
               Lat: 7.0 + (Math.random() * 0.5), 
               Lng: 125.4 + (Math.random() * 0.5) 
             });
           }
           setResults(mockData);
           setIsLoading(false);
        }
      }, 1500); // Fake delay for animation

    } catch (error) {
      alert("Error: " + error.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      {isLoading && <LoadingScreen />}

      <header className="top-bar">
        <div className="logo-section">
          <img className="globe-logo" src={globeLogo} alt="Globe Logo" />
        </div>
        <button className="btn primary-outline" onClick={handleExport}>Export View</button>
      </header>

      <main className="main-layout">
        <aside className="sidebar">
          <div className="upload-container">
            <h3>Data Input</h3>
            <div className="upload-group">
              <label className="input-label">Monitoring CSV</label>
              <div className="file-drop-area">
                <span className="file-msg">{monitorFile1 ? monitorFile1.name : "Drag & drop or click"}</span>
                <input className="file-input" type="file" accept=".csv" onChange={(e) => setMonitorFile1(e.target.files[0])} />
              </div>
            </div>
            <div className="upload-group">
              <label className="input-label">UDM CSV</label>
              <div className="file-drop-area">
                <span className="file-msg">{monitorFile2 ? monitorFile2.name : "Drag & drop or click"}</span>
                <input className="file-input" type="file" accept=".csv" onChange={(e) => setMonitorFile2(e.target.files[0])} />
              </div>
            </div>
            <button className="btn primary-filled full-width" onClick={handleScan} disabled={isLoading}>
              {isLoading ? "Scanning..." : "Scan Files"}
            </button>
          </div>

          <div className="sidebar-map-container">
            <div className="map-header-row">
              <h4>Site Visualizer</h4>
              <button className="expand-btn" onClick={() => setShowBigMap(true)} title="Expand Map">⤢</button>
            </div>
            <div className="mini-map">
              <MapContainer center={[selectedSite.lat, selectedSite.lng]} zoom={10} zoomControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapRecenter lat={selectedSite.lat} lng={selectedSite.lng} />
                <Marker position={[selectedSite.lat, selectedSite.lng]}>
                  <Popup>{selectedSite.id || "Active Site"}</Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        </aside>

        <section className="content-area">
          <div className="output-card">
            
            {/* PASSING FILTER PROPS TO DASHBOARD */}
            {results.length > 0 && (
              <Dashboard 
                data={results} 
                activeFilter={filterStatus}
                onFilterChange={setFilterStatus}
              />
            )}

            {results.length > 0 && (
              <div className="table-toolbar">
                <span className="table-label">
                  {filterStatus === 'ALL' ? 'Detailed Report' : `Filtered View: ${filterStatus}`}
                </span>
                <input 
                  type="text" 
                  className="search-bar" 
                  placeholder="Search PLA_ID..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}

            <div className="output-box">
              {results.length > 0 ? (
                <div className="table-wrapper">
                  <table className="result-table">
                    <thead>
                      <tr>
                        <th>PLA_ID</th>
                        <th>Status</th>
                        <th>NMS Name</th>
                        <th>UDM Name</th>
                        <th>Latitude</th>
                        <th>Longitude</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((row, i) => (
                        <tr 
                          key={i} 
                          className={`row-hover ${selectedSite.id === row.PLA_ID ? 'active-row' : ''}`}
                          onClick={() => {
                            const lat = parseFloat(row.Lat);
                            const lng = parseFloat(row.Lng);
                            setSelectedSite({ lat, lng, id: row.PLA_ID });
                          }}
                        >
                          <td className="font-bold">{row.PLA_ID}</td>
                          <td>
                            <span className={`status-badge ${row.Status.replace(/\s+/g, '-').toLowerCase()}`}>
                              {row.Status}
                            </span>
                          </td>
                          <td>{row["NMS Name"]}</td>
                          <td>{row["UDM Name"]}</td>
                          <td className="coord-text">{row.Lat}</td>
                          <td className="coord-text">{row.Lng}</td>
                        </tr>
                      ))}
                      {filteredResults.length === 0 && (
                         <tr>
                           <td colSpan="6" style={{textAlign: 'center', padding: '20px', color: '#888'}}>
                             No results found for "{searchTerm}" in {filterStatus} category.
                           </td>
                         </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="placeholder-container">
                  <p className="placeholder-text">Ready for file comparison. Please upload NMS and UDM CSV files.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {showBigMap && (
        <div className="map-modal-overlay">
          <div className="map-modal-content">
            <div className="map-modal-header">
              <h3>Site Location: {selectedSite.id || "Davao City"}</h3>
              <button className="close-btn" onClick={() => setShowBigMap(false)}>✖ Close</button>
            </div>
            <div className="big-map-wrapper">
              <MapContainer center={[selectedSite.lat, selectedSite.lng]} zoom={15} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapRecenter lat={selectedSite.lat} lng={selectedSite.lng} />
                <Marker position={[selectedSite.lat, selectedSite.lng]}>
                  <Popup>{selectedSite.id || "Active Site"}</Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App;