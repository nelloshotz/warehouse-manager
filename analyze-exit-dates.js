const XLSX = require('xlsx');
const fs = require('fs');

console.log('═══════════════════════════════════════════════════════════════');
console.log('  ANALISI DATE USCITE TROPPO ANTICHE E CALCOLO BANCALI');
console.log('═══════════════════════════════════════════════════════════════\n');

const workbook = XLSX.readFile('Magazzino Casilli Teverola - Generale new-1.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

const header = excelData[0];

// Indici colonne
const docNumIndex = 9; // Colonna J (10)
const dataIngressoIndex = 7; // Colonna H (8)
const bancaliIndex = 19; // Colonna T (20)

// Colonne uscite corrette
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

// Raccogli problemi
const problemiPerDocumento = new Map();

for (let i = 1; i < excelData.length; i++) {
  const row = excelData[i];
  const docNumRaw = row[docNumIndex];
  
  if (!isValidDocumentNumber(docNumRaw)) continue;
  
  const docNum = docNumRaw.trim();
  const dataIngressoRaw = row[dataIngressoIndex];
  const dataIngresso = parseDate(dataIngressoRaw);
  
  if (!dataIngresso) continue;
  
  const bancaliIngresso = Math.max(0, Math.floor(extractNumber(row[bancaliIndex])));
  
  if (bancaliIngresso === 0) continue;
  
  // Analizza uscite
  for (let j = 0; j < usciteDateColumns.length; j++) {
    const dataCol = usciteDateColumns[j] - 1;
    const bancaliCol = usciteBancaliColumns[j] - 1;
    
    const dataRaw = row[dataCol];
    const bancaliRaw = row[bancaliCol];
    
    const dataParsata = parseDate(dataRaw);
    const bancaliParsati = Math.max(0, Math.floor(extractNumber(bancaliRaw)));
    
    if (dataParsata && bancaliParsati > 0) {
      // Verifica se la data è troppo antica (1899)
      const isDataTroppoAntica = dataParsata.getUTCFullYear() === 1899;
      
      if (isDataTroppoAntica) {
        if (!problemiPerDocumento.has(docNum)) {
          problemiPerDocumento.set(docNum, {
            documento: docNum,
            righeExcel: [],
            dataIngresso: dataIngresso.toISOString().split('T')[0],
            bancaliIngresso: 0,
            uscite: []
          });
        }
        
        const docInfo = problemiPerDocumento.get(docNum);
        if (!docInfo.righeExcel.includes(i + 1)) {
          docInfo.righeExcel.push(i + 1);
        }
        docInfo.bancaliIngresso += bancaliIngresso;
        
        docInfo.uscite.push({
          rigaExcel: i + 1,
          numero: j + 1,
          dataRaw: dataRaw,
          dataParsata: dataParsata.toISOString().split('T')[0],
          bancali: bancaliParsati,
          colonnaData: usciteDateColumns[j],
          colonnaBancali: usciteBancaliColumns[j]
        });
      }
    }
  }
}

// Genera report
console.log('═══════════════════════════════════════════════════════════════');
console.log('  REPORT DOCUMENTI CON DATE USCITE TROPPO ANTICHE');
console.log('═══════════════════════════════════════════════════════════════\n');

const documentiConProblemi = Array.from(problemiPerDocumento.values());

if (documentiConProblemi.length === 0) {
  console.log('✅ Nessun documento con date uscite troppo antiche trovato!\n');
} else {
  console.log(`Trovati ${documentiConProblemi.length} documenti con problemi.\n\n`);
  
  documentiConProblemi.forEach((doc, idx) => {
    console.log(`${idx + 1}. DOCUMENTO: ${doc.documento}`);
    console.log(`   Righe Excel: ${doc.righeExcel.join(', ')}`);
    console.log(`   Data Ingresso: ${doc.dataIngresso}`);
    console.log(`   Totale Bancali Ingresso: ${doc.bancaliIngresso}`);
    
    // Calcola tutte le uscite per questo documento
    console.log(`\n   CALCOLO COMPLETO USCITE:`);
    
    // Trova tutte le righe di questo documento
    const righeDocumento = [];
    for (let i = 1; i < excelData.length; i++) {
      const row = excelData[i];
      const docNumRaw = row[docNumIndex];
      if (isValidDocumentNumber(docNumRaw) && docNumRaw.trim() === doc.documento) {
        const bancaliRiga = Math.max(0, Math.floor(extractNumber(row[bancaliIndex])));
        righeDocumento.push({ rigaExcel: i + 1, row, bancaliRiga });
      }
    }
    
    let totaleIngressoDocumento = 0;
    let totaleUsciteDocumento = 0;
    const usciteDocumento = [];
    
    righeDocumento.forEach((rigaInfo, rigaIdx) => {
      const row = rigaInfo.row;
      totaleIngressoDocumento += rigaInfo.bancaliRiga;
      
      console.log(`\n     Riga Excel ${rigaInfo.rigaExcel} (${rigaIdx + 1}/${righeDocumento.length}):`);
      console.log(`       Bancali ingresso: ${rigaInfo.bancaliRiga}`);
      
      let rimanentiRiga = rigaInfo.bancaliRiga;
      const usciteRiga = [];
      
      for (let j = 0; j < usciteDateColumns.length; j++) {
        const dataCol = usciteDateColumns[j] - 1;
        const bancaliCol = usciteBancaliColumns[j] - 1;
        
        const dataRaw = row[dataCol];
        const bancaliRaw = row[bancaliCol];
        
        const dataParsata = parseDate(dataRaw);
        const bancaliParsati = Math.max(0, Math.floor(extractNumber(bancaliRaw)));
        
        if (dataParsata && bancaliParsati > 0) {
          const isDataTroppoAntica = dataParsata.getUTCFullYear() === 1899;
          rimanentiRiga -= bancaliParsati;
          if (rimanentiRiga < 0) rimanentiRiga = 0;
          
          usciteRiga.push({
            numero: j + 1,
            data: dataParsata.toISOString().split('T')[0],
            bancali: bancaliParsati,
            rimanenti: rimanentiRiga,
            troppoAntica: isDataTroppoAntica
          });
          
          totaleUsciteDocumento += bancaliParsati;
        }
      }
      
      if (usciteRiga.length > 0) {
        console.log(`       Uscite:`);
        usciteRiga.forEach(u => {
          const warning = u.troppoAntica ? ' ⚠️ DATA TROPPO ANTICA (1899)' : '';
          console.log(`         - Uscita ${u.numero}: ${u.bancali} bancali il ${u.data} → Rimanenti: ${u.rimanenti}${warning}`);
        });
        console.log(`       Totale uscite riga: ${usciteRiga.reduce((sum, u) => sum + u.bancali, 0)}`);
        console.log(`       Rimanenti riga: ${rimanentiRiga}`);
      } else {
        console.log(`       Nessuna uscita`);
        console.log(`       Rimanenti riga: ${rimanentiRiga}`);
      }
    });
    
    const totaleRimanentiDocumento = totaleIngressoDocumento - totaleUsciteDocumento;
    
    console.log(`\n   📊 RIEPILOGO DOCUMENTO:`);
    console.log(`       Totale bancali ingresso: ${totaleIngressoDocumento}`);
    console.log(`       Totale bancali usciti: ${totaleUsciteDocumento}`);
    console.log(`       Totale bancali rimanenti: ${Math.max(0, totaleRimanentiDocumento)}`);
    
    console.log('\n' + '─'.repeat(70) + '\n');
  });
}

console.log('═══════════════════════════════════════════════════════════════');



