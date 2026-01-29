const XLSX = require('xlsx');
const fs = require('fs');

// Leggi il report per estrarre i documenti con date troppo antiche
const reportContent = fs.readFileSync('report-problemi-date-uscite.txt', 'utf8');
const documentiConDateAntiche = new Set();

// Estrai documenti con DATA_TROPPO_ANTICA
const lines = reportContent.split('\n');
let currentDoc = null;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('Documento:')) {
    const match = line.match(/Documento:\s*(.+)/);
    if (match) currentDoc = match[1].trim();
  }
  if (line.includes('DATA_TROPPO_ANTICA') && currentDoc) {
    documentiConDateAntiche.add(currentDoc);
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('  ANALISI DATE USCITE TROPPO ANTICHE (1899)');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log(`Documenti con date troppo antiche trovati: ${documentiConDateAntiche.size}\n`);

// Carica Excel
const workbook = XLSX.readFile('Magazzino Casilli Teverola - Generale new-1.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

const docNumIndex = 9;
const dataIngressoIndex = 7;
const bancaliIndex = 19;

const usciteDateColumns = [28, 34, 40, 46, 52, 58, 64, 70, 76, 82, 88, 94, 100, 106, 112];
const usciteBancaliColumns = [27, 33, 39, 45, 51, 57, 63, 69, 75, 81, 87, 93, 99, 105, 111];

function parseDate(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const dateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (dateMatch) {
      let month = parseInt(dateMatch[1], 10);
      let day = parseInt(dateMatch[2], 10);
      let year = parseInt(dateMatch[3], 10);
      if (year < 100) {
        year = year <= 50 ? 2000 + year : 1900 + year;
      }
      return new Date(Date.UTC(year, month - 1, day));
    }
  }
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + value * 86400000);
  }
  return null;
}

function extractNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value.replace(/[^\d.,-]/g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function isValidDocumentNumber(docNum) {
  if (!docNum || typeof docNum !== 'string') return false;
  const match = docNum.match(/^(\d{4})\/(\d+)\s*-\s*(.+)$/);
  return match !== null;
}

// Analizza ogni documento
const documentiAnalizzati = [];

documentiConDateAntiche.forEach(docNum => {
  const righeDocumento = [];
  
  // Trova tutte le righe di questo documento
  for (let i = 1; i < excelData.length; i++) {
    const row = excelData[i];
    const docNumRaw = row[docNumIndex];
    if (isValidDocumentNumber(docNumRaw) && docNumRaw.trim() === docNum) {
      const dataIngressoRaw = row[dataIngressoIndex];
      const dataIngresso = parseDate(dataIngressoRaw);
      const bancaliIngresso = Math.max(0, Math.floor(extractNumber(row[bancaliIndex])));
      
      if (dataIngresso && bancaliIngresso > 0) {
        righeDocumento.push({
          rigaExcel: i + 1,
          dataIngresso: dataIngresso.toISOString().split('T')[0],
          bancaliIngresso: bancaliIngresso,
          row
        });
      }
    }
  }
  
  if (righeDocumento.length > 0) {
    documentiAnalizzati.push({
      documento: docNum,
      righe: righeDocumento
    });
  }
});

// Genera report
console.log('═══════════════════════════════════════════════════════════════');
console.log('  REPORT DETTAGLIATO PER DOCUMENTO');
console.log('═══════════════════════════════════════════════════════════════\n\n');

documentiAnalizzati.forEach((doc, idx) => {
  console.log(`${idx + 1}. DOCUMENTO: ${doc.documento}`);
  console.log('─'.repeat(70));
  
  let totaleIngresso = 0;
  let totaleUscite = 0;
  
  doc.righe.forEach((riga, rigaIdx) => {
    console.log(`\n   Riga Excel ${riga.rigaExcel} (${rigaIdx + 1}/${doc.righe.length}):`);
    console.log(`   Data Ingresso: ${riga.dataIngresso}`);
    console.log(`   Bancali Ingresso: ${riga.bancaliIngresso}`);
    
    totaleIngresso += riga.bancaliIngresso;
    
    let rimanenti = riga.bancaliIngresso;
    const uscite = [];
    
    for (let j = 0; j < usciteDateColumns.length; j++) {
      const dataCol = usciteDateColumns[j] - 1;
      const bancaliCol = usciteBancaliColumns[j] - 1;
      
      const dataRaw = riga.row[dataCol];
      const bancaliRaw = riga.row[bancaliCol];
      
      const dataParsata = parseDate(dataRaw);
      const bancaliParsati = Math.max(0, Math.floor(extractNumber(bancaliRaw)));
      
      if (dataParsata && bancaliParsati > 0) {
        const isDataTroppoAntica = dataParsata.getUTCFullYear() === 1899;
        rimanenti -= bancaliParsati;
        if (rimanenti < 0) rimanenti = 0;
        
        uscite.push({
          numero: j + 1,
          data: dataParsata.toISOString().split('T')[0],
          bancali: bancaliParsati,
          rimanenti: rimanenti,
          troppoAntica: isDataTroppoAntica
        });
        
        totaleUscite += bancaliParsati;
      }
    }
    
    if (uscite.length > 0) {
      console.log(`   Uscite:`);
      uscite.forEach(u => {
        const warning = u.troppoAntica ? ' ⚠️ DATA TROPPO ANTICA (1899)' : '';
        console.log(`     - Uscita ${u.numero}: ${u.bancali} bancali il ${u.data} → Rimanenti: ${u.rimanenti}${warning}`);
      });
      console.log(`   Totale uscite riga: ${uscite.reduce((sum, u) => sum + u.bancali, 0)}`);
      console.log(`   Rimanenti riga: ${rimanenti}`);
    } else {
      console.log(`   Nessuna uscita`);
      console.log(`   Rimanenti riga: ${rimanenti}`);
    }
  });
  
  const totaleRimanenti = totaleIngresso - totaleUscite;
  
  console.log(`\n   📊 RIEPILOGO DOCUMENTO ${doc.documento}:`);
  console.log(`   Totale bancali ingresso: ${totaleIngresso}`);
  console.log(`   Totale bancali usciti: ${totaleUscite}`);
  console.log(`   Totale bancali rimanenti: ${Math.max(0, totaleRimanenti)}`);
  
  console.log('\n' + '═'.repeat(70) + '\n');
});

console.log('═══════════════════════════════════════════════════════════════');



