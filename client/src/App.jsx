import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import globeLogo from './assets/Globe_Logo.jpg'
import './App.css'

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

// --- COMPONENT: DASHBOARD ---
function Dashboard({ data }) {
  if (!data || data.length === 0) return null;

  const newSites = data.filter(r => r.Status === 'NEW SITE').length;
  const removed = data.filter(r => r.Status === 'REMOVED SITE').length;
  const mismatch = data.filter(r => r.Status === 'NAME MISMATCH').length;

  const chartData = [
    { name: 'New', value: newSites, color: '#28a745' },
    { name: 'Removed', value: removed, color: '#dc3545' },
    { name: 'Mismatch', value: mismatch, color: '#ffc107' }
  ].filter(item => item.value > 0);

  return (
    <div className="dashboard-container">
      {/* CHART SECTION */}
      <div className="chart-section">
        <h4 className="chart-title">Breakdown</h4>
        <div style={{ width: '100%', height: 130 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie 
                data={chartData} 
                cx="50%" 
                cy="50%" 
                innerRadius={35} 
                outerRadius={55} 
                paddingAngle={5} 
                dataKey="value"
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

      {/* STATS CARDS */}
      <div className="cards-section">
        <div className="stat-card total">
          <span className="stat-label">Total</span>
          <span className="stat-value">{data.length}</span>
        </div>
        <div className="stat-card new">
          <span className="stat-label">New</span>
          <span className="stat-value">{newSites}</span>
        </div>
        <div className="stat-card removed">
          <span className="stat-label">Removed</span>
          <span className="stat-value">{removed}</span>
        </div>
        <div className="stat-card mismatch">
          <span className="stat-label">Mismatch</span>
          <span className="stat-value">{mismatch}</span>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [monitorFile1, setMonitorFile1] = useState(null);
  const [monitorFile2, setMonitorFile2] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSite, setSelectedSite] = useState({ lat: 7.1905, lng: 125.4503 });
  const [showBigMap, setShowBigMap] = useState(false);

  const filteredResults = results.filter(row => 
    row.PLA_ID.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row["NMS Name"].toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    const rows = results.map(row => [
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
    link.download = "network_reconciliation_report.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleScan = async () => {
    if (!monitorFile1 || !monitorFile2) {
      alert("Please upload both CSV files.");
      return;
    }
    setIsLoading(true); // START ANIMATION
    setResults([]);

    try {
      const text1 = await readFileAsText(monitorFile1);
      const text2 = await readFileAsText(monitorFile2);

      // We use a small timeout to allow React to render the Loading Screen 
      // before the heavy calculation freezes the UI momentarily.
      setTimeout(() => {
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
                setIsLoading(false); // STOP ANIMATION
              })
              .withFailureHandler((err) => {
                alert("Connection Failed: " + err);
                setIsLoading(false); // STOP ANIMATION
              })
              .processCSVComparison(text1, text2);
          } else {
            setIsLoading(false);
            alert("Google Script not found. (Local Mode)");
          }
      }, 100);

    } catch (error) {
      alert("Error: " + error.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      
      {/* --- SHOW LOADING SCREEN IF PROCESSING --- */}
      {isLoading && <LoadingScreen />}

      <header className="top-bar">
        <div className="logo-section">
          <img className="globe-logo" src={globeLogo} alt="Globe Logo" />
        </div>
        <button className="btn primary-outline" onClick={handleExport}>Export File</button>
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
            
            {results.length > 0 && <Dashboard data={results} />}

            {results.length > 0 && (
              <div className="table-toolbar">
                <span className="table-label">Detailed Report</span>
                <input 
                  type="text" 
                  className="search-bar" 
                  placeholder="Filter by PLA_ID..." 
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

export default App