/* public/Code.js */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Network Reconciliation Tool')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function processCSVComparison(nmsText, udmText) {
  try {
    // 1. Parse CSVs
    var nmsData = Utilities.parseCsv(nmsText);
    var udmData = Utilities.parseCsv(udmText);

    if (nmsData.length < 2 || udmData.length < 2) throw new Error("File(s) empty.");

    // 2. Map Headers
    var nmsHeaders = nmsData[0];
    var udmHeaders = udmData[0];

    // Helper: Find column index by name (case-insensitive)
    function getIndex(headers, possibleNames) {
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i].trim().toUpperCase();
        if (possibleNames.indexOf(h) > -1) return i;
      }
      return -1;
    }

    // FIND KEY COLUMNS (PLA_ID)
    var nmsIdIdx = getIndex(nmsHeaders, ['PLA_ID', 'SITE ID', 'NE ID']);
    var udmIdIdx = getIndex(udmHeaders, ['PLA_ID', 'SITE ID', 'NE ID']);

    if (nmsIdIdx === -1 || udmIdIdx === -1) throw new Error("Could not find 'PLA_ID' column.");

    // FIND ATTRIBUTE COLUMNS (Tech Name / BTS Name)
    // Add other variations here if needed: "SITE_NAME", "NAME", etc.
    var nmsNameIdx = getIndex(nmsHeaders, ['TECH NAME', 'BTS NAME', 'BTS_NAME', 'SITE NAME']);
    var udmNameIdx = getIndex(udmHeaders, ['TECH NAME', 'BTS NAME', 'BTS_NAME', 'SITE NAME']);

    // 3. Create Lookup Maps (Dictionaries) for fast comparison
    // Structure: { "ID_123": { row: [data], name: "SiteA" } }
    var nmsMap = {};
    for (var i = 1; i < nmsData.length; i++) {
      var id = nmsData[i][nmsIdIdx];
      if (id) nmsMap[id.trim()] = { 
        fullRow: nmsData[i], 
        name: (nmsNameIdx > -1 ? nmsData[i][nmsNameIdx] : "") 
      };
    }

    var udmMap = {};
    for (var j = 1; j < udmData.length; j++) {
      var id = udmData[j][udmIdIdx];
      if (id) udmMap[id.trim()] = { 
        fullRow: udmData[j], 
        name: (udmNameIdx > -1 ? udmData[j][udmNameIdx] : "") 
      };
    }

    // 4. PERFORM RECONCILIATION
    var report = [];

    // Check NMS vs UDM (Find NEW and UPDATED)
    for (var id in nmsMap) {
      var nmsEntry = nmsMap[id];
      var udmEntry = udmMap[id];

      if (!udmEntry) {
        // CONDITION 1: NEW SITE (In NMS, not in UDM)
        report.push({
          "PLA_ID": id,
          "Status": "NEW SITE",
          "NMS Name": nmsEntry.name,
          "UDM Name": "N/A",
          "Details": "Found in NMS only"
        });
      } else {
        // CONDITION 2: CHECK FOR CHANGES (Both exist)
        // We trim and lowercase to ignore minor spacing differences
        if (nmsEntry.name.trim().toLowerCase() !== udmEntry.name.trim().toLowerCase()) {
          report.push({
            "PLA_ID": id,
            "Status": "NAME MISMATCH",
            "NMS Name": nmsEntry.name,
            "UDM Name": udmEntry.name,
            "Details": "Suffix/Prefix Update Detected"
          });
        }
      }
    }

    // Check UDM vs NMS (Find REMOVED)
    for (var id in udmMap) {
      if (!nmsMap[id]) {
        // CONDITION 3: REMOVED SITE (In UDM, not in NMS)
        report.push({
          "PLA_ID": id,
          "Status": "REMOVED SITE",
          "NMS Name": "N/A",
          "UDM Name": udmMap[id].name,
          "Details": "Found in UDM only"
        });
      }
    }

    // 5. Return Result
    return JSON.stringify({
      success: true,
      data: report,
      count: report.length
    });

  } catch (e) {
    return JSON.stringify({ success: false, error: e.toString() });
  }
}