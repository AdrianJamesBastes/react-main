import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import globeLogo from './assets/Globe_Logo.jpg'
import './App.css'

// --- FIX FOR BROKEN MAP MARKER ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper to move map (Reused for both mini and big maps)
function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize(); // Crucial for the popup map to render correctly
    if (lat && lng) map.flyTo([lat, lng], 15);
  }, [lat, lng, map]);
  return null;
}

function App() {
  const [monitorFile1, setMonitorFile1] = useState(null);
  const [monitorFile2, setMonitorFile2] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSite, setSelectedSite] = useState({ lat: 7.1905, lng: 125.4503 });
  
  // NEW: State for the Pop-up Map
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

  const handleScan = async () => {
    if (!monitorFile1 || !monitorFile2) {
      alert("Please upload both CSV files.");
      return;
    }
    setIsLoading(true);
    setResults([]);

    try {
      const text1 = await readFileAsText(monitorFile1);
      const text2 = await readFileAsText(monitorFile2);

      if (window.google && window.google.script) {
        window.google.script.run
          .withSuccessHandler((response) => {
            const res = JSON.parse(response);
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
        setIsLoading(false);
        alert("Google Script not found. (Local Mode)");
      }
    } catch (error) {
      alert("Error reading files: " + error.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="top-bar">
        <div className="logo-section">
          <img className="globe-logo" src={globeLogo} alt="Globe Logo" />
        </div>
        <button className="btn primary-outline">Export File</button>
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
            <div className="output-header">
              <h3>Output: <span className="issue-count">{results.length} Issues</span></h3>
              <input 
                type="text" 
                className="search-bar" 
                placeholder="Filter by PLA_ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
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

      {/* --- BIG MAP POPUP --- */}
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