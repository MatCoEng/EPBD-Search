// script.js
let currentLanguage = 'nl';
let sheetData = {}; // Changed to object to store all sheet data
let currentSheet = '1-1-1'; // Default active sheet
let currentSortColumn = -1;
let currentSortOrder = 'asc';

// Classification mapping data
const classificatieData = `1.1.1.1Minerale wolMW
1.1.1.2Cellulair glasCG
1.1.1.3Geëxpandeerd perlietEPB
1.1.1.4Geëxpandeerd vermiculietEVB
1.1.1.5Geëxpandeerd polystyreenEPS
1.1.1.6Geëxtrudeerd polystyreenXPS
1.1.1.7Polyurethaan/PolyisocyanuraatPUR/PIR
1.1.1.8FenolschuimPF
1.1.1.9HoutwolWW
1.1.1.10Geëxpandeerde kurkICB
1.1.1.11HoutvezelWF
1.1.1.12Geëxtrudeer polyethyleenPEF
1.1.1.13Cellulose
1.1.1.14Materiaal op basis van dierlijke en/of plantaardige vezels
1.1.1.15Vacuum isolatie paneelVIP
1.1.1.20Anderen
1.1.2.1Minerale wol - in bulkMW
1.1.2.2Geëxpandeerd perliet - in bulkEP
1.1.2.3Geëxfolieerd vermiculiet - in bulkEV
1.1.2.4Geëxtrudeerd polystyreen - in bulkEPS
1.1.2.5Polyurethaan hardschuim - gespotenPUR
1.1.2.6Polyurethaan hardschuim - geïnjecteerdPUR
1.1.2.7Ureumformolschuim - formaldehydeUF
1.1.2.8FenolschuimPF
1.1.2.9Materiaal op basis van lichte korrels van geëxpandeerde klei - in bulkLWA
1.1.2.10Cellulose - in bulk
1.1.2.11Materiaal op basis van dierlijke en/of plantaardige vezels
1.1.2.20Anderen
1.2.1.1Metselwerkelement - steen van gebakken aarde
1.2.1.2Metselwerkelement - kalkzandsteen
1.2.1.3Metselwerkelement - beton met aggregaten (gewone en lichte aggregaten)
1.2.1.4Metselwerkelement - geautoclaveerde cellenbeton
1.2.1.5Metselwerkelement - kunststeen
1.2.1.6Metselwerkelement - natuursteen
1.2.2.1Beton en mortel - zwaar normaal beton
1.2.2.2Beton en mortel - licht beton en mortel met lichte isolerende vulstoffen (densiteit < 1600 kg/m³)
1.2.3Hout en houtderivaten
1.2.4Composietproduct (sandwichpaneel, enz.)
1.2.5Anderen (glas, bitumen, plastiek, enz.)
2.3.1Buitenzonwering met doek
2.3.2Buitenzonwering met lamellen
2.3.3Luiken en rolluiken
2.3.4Binnenzonwering met doek
2.3.5Binnenzonwering met lamellen
2.3.6Anderen`;

// Helper functions
function createClassificationMap(text) {
    const codeToDesc = {};
    text.split('\n').forEach(line => {
        const codeEndIndex = line.search(/[^0-9.]/);
        if (codeEndIndex === -1) return;
        const code = line.substring(0, codeEndIndex);
        const rest = line.substring(codeEndIndex);
        const abbrIndex = rest.search(/[A-Z]{2,}/);
        const description = abbrIndex !== -1 ? rest.substring(0, abbrIndex) : rest;
        const abbr = abbrIndex !== -1 ? rest.substring(abbrIndex) : '';
        codeToDesc[code] = abbr ? `${description.trim()} (${abbr})` : description.trim();
    });
    return codeToDesc;
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Create a debounced version of filterTable
const debouncedFilterTable = debounce(filterTable, 300);

// Functie om data te laden van JSON-bestand
function loadData() {
    const loadingElement = document.getElementById("loading");
    loadingElement.style.display = "block";
    
    // Array of sheet IDs to load
    const sheetIds = ['1-1-1', '1-1-2', '1-2', '2-3'];
    const promises = [];
    
    // Create a promise for each JSON file
    sheetIds.forEach(sheetId => {
        const promise = fetch(`https://raw.githubusercontent.com/MatCoEng/EPBD-Search/main/data/epbd-data-${sheetId}.json`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for sheet ${sheetId}`);
                }
                return response.json();
            })
            .then(json => {
                sheetData[sheetId] = json;
                return true;
            })
            .catch(error => {
                console.error(`Error loading data for sheet ${sheetId}:`, error);
                return false;
            });
        
        promises.push(promise);
    });
    
    // Wait for all promises to resolve
    Promise.all(promises)
        .then(results => {
            loadingElement.style.display = "none";
            
            // Check if at least one file was loaded successfully
            if (results.some(success => success)) {
                // Set the current sheet to the first successful one
                for (const sheetId of sheetIds) {
                    if (sheetData[sheetId]) {
                        currentSheet = sheetId;
                        break;
                    }
                }
                
                updateTable(currentLanguage);
                setupTabButtons();
            } else {
                document.getElementById("table-container").innerHTML = 
                    `<div class="error-message">Error: Could not load any data files.</div>`;
            }
        });
}

function setupTabButtons() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        const sheetId = button.getAttribute('data-sheet');
        
        // Skip if we don't have data for this sheet
        if (!sheetData[sheetId]) {
            button.disabled = true;
            button.title = "Data unavailable";
            return;
        }
        
        button.addEventListener('click', () => {
            // Do nothing if this tab is already active
            if (currentSheet === sheetId) return;
            
            // Update active tab
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
            
            // Update current sheet and refresh table
            currentSheet = sheetId;
            currentSortColumn = -1;
            currentSortOrder = 'asc';
            updateTable(currentLanguage);
        });
    });
}

function isWithinDateRange(dateToCheck, rangeString) {
    try {
        const [startStr, endStr] = rangeString.split(" tot ").map(d => d.trim());
        const parseDate = (dateStr) => {
            const [day, month, year] = dateStr.split("-").map(Number);
            return new Date(year, month - 1, day);
        };
        const startDate = parseDate(startStr);
        const endDate = parseDate(endStr);
        const checkDate = new Date(dateToCheck);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || isNaN(checkDate.getTime())) {
            return false;
        }
        return checkDate >= startDate && checkDate <= endDate;
    } catch (e) {
        console.error("Error parsing date range:", e);
        return false;
    }
}

function isWithinThicknessRange(thickness, rangeString) {
    try {
        thickness = parseFloat(thickness);
        if (isNaN(thickness)) return false;
        
        const parts = rangeString.replace(" m", "").split(" - ");
        if (parts.length === 1) {
            const value = parseFloat(parts[0]);
            return Math.abs(thickness - value) < 0.001;
        } else {
            const min = parseFloat(parts[0]);
            const max = parseFloat(parts[1]);
            return thickness >= min && thickness <= max;
        }
    } catch (e) {
        console.error("Error parsing thickness range:", e);
        return false;
    }
}

function parseDateFromRange(rangeStr, useStart) {
    if (!rangeStr) return new Date(0);
    const parts = rangeStr.split(" tot ");
    let dateStr = useStart ? parts[0] : (parts[1] || parts[0]);
    dateStr = dateStr.trim();
    const dateParts = dateStr.split("-");
    if (dateParts.length !== 3) return new Date(0);
    const [day, month, year] = dateParts.map(Number);
    return new Date(year, month - 1, day);
}

// Table update and filtering functions
function updateTable(language) {
    if (!sheetData[currentSheet]) {
        console.error(`No data available for sheet ${currentSheet}.`);
        return;
    }
    
    const codeToDesc = createClassificationMap(classificatieData);
    currentLanguage = language;
    const tableContainer = document.getElementById("table-container");
    tableContainer.innerHTML = "";
    const headers = sheetData[currentSheet].headers[language];
    const data = sheetData[currentSheet].data;

    // Check if thickness filter should be visible based on sheet type
    const thicknessFilterContainer = document.getElementById("thicknessFilter").parentElement.parentElement;
    if (thicknessFilterContainer) {
        thicknessFilterContainer.style.display = ['1-1-1', '1-1-2', '1-2'].includes(currentSheet) ? 'block' : 'none';
    }

    let table = document.createElement("table");
    table.border = "1";

    // Create header
    let thead = document.createElement("thead");
    let headerRow = document.createElement("tr");
    headers.forEach((headerText, index) => {
        let th = document.createElement("th");
        th.setAttribute("data-original", headerText);
        th.textContent = headerText;
        th.addEventListener("click", function() {
            sortTableByColumn(index);
        });
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body
    let tbody = document.createElement("tbody");
    data.forEach(row => {
        let tr = document.createElement("tr");
        row.forEach((cell, index) => {
            let td = document.createElement("td");
            // Special handling for type column in insulation materials
            if (index === 3 && ['1-1-1', '1-1-2', '1-2', '2-3'].includes(currentSheet) && codeToDesc[cell]) {
                td.textContent = codeToDesc[cell];
            } else {
                td.textContent = cell;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableContainer.appendChild(table);

    filterTable();
    updateSortIndicators();
}

function filterTable() {
    const searchInput = document.getElementById("searchInput").value.toLowerCase();
    const dateInput = document.getElementById("dateInput").value;
    const filterByDate = document.getElementById("dateFilter").checked;
    const thicknessInput = document.getElementById("thicknessInput").value;
    const filterByThickness = document.getElementById("thicknessFilter").checked;
    
    const searchTerms = searchInput.split(" ").filter(term => term.length > 0);
    const tbody = document.querySelector("tbody");
    if (!tbody) return;
    
    const rows = tbody.getElementsByTagName("tr");

    for (let row of rows) {
        const cells = row.getElementsByTagName("td");
        if (!cells.length) continue;

        if (!row.hasAttribute('data-original')) {
            const originalValues = Array.from(cells).map(cell => cell.textContent);
            row.setAttribute('data-original', JSON.stringify(originalValues));
        }
        
        const originalValues = JSON.parse(row.getAttribute('data-original'));
        
        Array.from(cells).forEach((cell, index) => {
            cell.textContent = originalValues[index];
        });
        
        const rowText = originalValues.join(" ").toLowerCase();
        
        // Check if all search terms are in the row
        const matchesSearch = searchTerms.every(term => rowText.includes(term));
        
        // Date filter
        let matchesDate = true;
        if (filterByDate && dateInput) {
            const validityRange = originalValues[0];
            matchesDate = isWithinDateRange(dateInput, validityRange);
        }

        // Thickness filter - only apply for insulation sheets
        let matchesThickness = true;
        if (filterByThickness && thicknessInput && ['1-1-1', '1-1-2', '1-2'].includes(currentSheet)) {
            const thicknessRange = originalValues[4];
            matchesThickness = isWithinThicknessRange(thicknessInput, thicknessRange);
        }

        const visible = matchesSearch && matchesDate && matchesThickness;
        row.style.display = visible ? "" : "none";

        // Highlight search terms if row is visible
        if (visible && searchInput) {
            Array.from(cells).forEach((cell, index) => {
                let text = originalValues[index];
                searchTerms.forEach(term => {
                    if (term) {
                        const regex = new RegExp(term, 'gi');
                        text = text.replace(regex, match => `<span class="highlight">${match}</span>`);
                    }
                });
                cell.innerHTML = text;
            });
        }
    }
}

// Sorting functions
function updateSortIndicators() {
    const thElements = document.querySelectorAll("#table-container table thead th");
    thElements.forEach((th, index) => {
        const originalText = th.getAttribute("data-original");
        if (index === currentSortColumn) {
            if (currentSortOrder === 'asc') {
                th.innerHTML = originalText + " &#9650;"; // ▲
            } else {
                th.innerHTML = originalText + " &#9660;"; // ▼
            }
        } else {
            th.textContent = originalText;
        }
    });
}

function sortTableByColumn(columnIndex) {
    const table = document.querySelector("#table-container table");
    if (!table) return;
    const tbody = table.querySelector("tbody");
    let rows = Array.from(tbody.querySelectorAll("tr"));
    
    // Toggle sort order if same column is clicked
    if (currentSortColumn === columnIndex) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = columnIndex;
        currentSortOrder = 'asc';
    }
    
    rows.sort((a, b) => {
        const cellA = a.querySelectorAll("td")[columnIndex].textContent.trim();
        const cellB = b.querySelectorAll("td")[columnIndex].textContent.trim();
        
        // Empty values go to bottom
        const isEmptyA = cellA === "";
        const isEmptyB = cellB === "";
        if (isEmptyA && !isEmptyB) return 1;
        if (!isEmptyA && isEmptyB) return -1;
        if (isEmptyA && isEmptyB) return 0;
        
        // Special sorting for validity date (column 0)
        if (columnIndex === 0) {
            const dateA = parseDateFromRange(cellA, currentSortOrder === 'asc');
            const dateB = parseDateFromRange(cellB, currentSortOrder === 'asc');
            return currentSortOrder === 'asc' ? 
                dateA.getTime() - dateB.getTime() : 
                dateB.getTime() - dateA.getTime();
        }
        
        // Try numeric sorting
        const numA = parseFloat(cellA);
        const numB = parseFloat(cellB);
        let cmp = 0;
        if (!isNaN(numA) && !isNaN(numB)) {
            cmp = numA - numB;
        } else {
            cmp = cellA.toLowerCase().localeCompare(cellB.toLowerCase());
        }
        return currentSortOrder === 'asc' ? cmp : -cmp;
    });
    
    rows.forEach(row => tbody.appendChild(row));
    updateSortIndicators();
}