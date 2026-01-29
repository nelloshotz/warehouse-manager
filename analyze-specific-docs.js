const XLSX = require('xlsx');
const fs = require('fs');

// Documenti con date troppo antiche da analizzare
const documentiDaAnalizzare = [
  '2024/5978',
  '2024/6936', 
  '2024/6937',
  '2024/7280',
  '2024/7294'
];

console.log('Caricamento file Excel...');
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

let output = '═══════════════════════════════════════════════════════════════\n';
output += '  REPORT DATE USCITE TROPPO ANTICHE (1899) - ANALISI DETTAGLIATA\n';
output += '═══════════════════════════════════════════════════════════════\n\n';

documentiDaAnalizzare.forEach((docNum, idx) => {
  output += `${idx + 1}. DOCUMENTO: ${docNum}\n`;
  output += '─'.repeat(70) + '\n';
  
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
  
  if (righeDocumento.length === 0) {
    output += `   ⚠️  Nessuna riga trovata per questo documento\n\n`;
    return;
  }
  
  let totaleIngresso = 0;
  let totaleUscite = 0;
  
  righeDocumento.forEach((riga, rigaIdx) => {
    output += `\n   Riga Excel ${riga.rigaExcel} (${rigaIdx + 1}/${righeDocumento.length}):\n`;
    output += `   Data Ingresso: ${riga.dataIngresso}\n`;
    output += `   Bancali Ingresso: ${riga.bancaliIngresso}\n`;
    
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
      output += `   Uscite:\n`;
      uscite.forEach(u => {
        const warning = u.troppoAntica ? ' ⚠️ DATA TROPPO ANTICA (1899)' : '';
        output += `     - Uscita ${u.numero}: ${u.bancali} bancali il ${u.data} → Rimanenti: ${u.rimanenti}${warning}\n`;
      });
      output += `   Totale uscite riga: ${uscite.reduce((sum, u) => sum + u.bancali, 0)}\n`;
      output += `   Rimanenti riga: ${rimanenti}\n`;
    } else {
      output += `   Nessuna uscita\n`;
      output += `   Rimanenti riga: ${rimanenti}\n`;
    }
  });
  
  const totaleRimanenti = totaleIngresso - totaleUscite;
  
  output += `\n   📊 RIEPILOGO DOCUMENTO ${docNum}:\n`;
  output += `   Totale bancali ingresso: ${totaleIngresso}\n`;
  output += `   Totale bancali usciti: ${totaleUscite}\n`;
  output += `   Totale bancali rimanenti: ${Math.max(0, totaleRimanenti)}\n`;
  
  output += '\n' + '═'.repeat(70) + '\n\n';
});

output += '═══════════════════════════════════════════════════════════════\n';

// Scrivi il file
fs.writeFileSync('report-analisi-date-antiche.txt', output);
console.log('Report generato: report-analisi-date-antiche.txt');



