import * as FileSystem from 'expo-file-system';
import { Document, DocumentRow } from '@/types/warehouse';

// Cache per Platform per evitare accessi multipli
let platformCache: { OS: string } | null | undefined = undefined;

// Prova a importare Platform in modo statico (compatibile con build)
let ReactNativePlatform: { OS: string } | null = null;
try {
  // Import statico che funziona sia in runtime che durante il build
  const reactNative = require('react-native');
  if (reactNative && reactNative.Platform) {
    ReactNativePlatform = reactNative.Platform;
  }
} catch (e) {
  // Ignora errori durante l'import
  ReactNativePlatform = null;
}

// Funzione helper per ottenere Platform in modo sicuro
function getPlatform(): { OS: string } | null {
  // Se già in cache, restituisci il valore
  if (platformCache !== undefined) {
    return platformCache;
  }
  
  // Usa il valore importato staticamente
  platformCache = ReactNativePlatform;
  return platformCache;
}

export interface ExcelParseResult {
  documents: Document[];
  documentRows: DocumentRow[];
  errors: string[];
  skippedRows: number;
  dateFuture?: Array<{
    documento: string;
    dateFuture: Array<{ data: string; bancali: number; tipologia: string }>;
  }>;
  validationErrors?: Array<{
    documento: string;
    tipo: 'date_future' | 'uscite_superiori_ingresso' | 'data_uscita_precedente_ingresso' | 'bancali_senza_data' | 'data_senza_bancali';
    dettagli: string;
    riga?: number;
  }>;
}

export interface ParseProgress {
  current: number;
  total: number;
  stage: 'reading' | 'parsing' | 'processing';
}

// Cattura Date a livello di modulo per evitare problemi di inizializzazione durante minificazione
const DateConstructor = (typeof globalThis !== 'undefined' && globalThis.Date) || 
                        (typeof window !== 'undefined' && window.Date) || 
                        (typeof global !== 'undefined' && global.Date) || 
                        Date;

// Funzioni helper (copiate dal parser Excel)

/**
 * Parsa una data ambigua (es. "02/01/2024") considerando il contesto
 * Se entrambe le interpretazioni sono valide, sceglie quella che rende la data >= data di riferimento
 * (utile per date di uscita che devono essere >= data di ingresso)
 */
function parseDateWithContext(value: any, referenceDate?: string | null): string | null {
  if (!value) return null;
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    
    const dateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (dateMatch) {
      const part1 = parseInt(dateMatch[1], 10);
      const part2 = parseInt(dateMatch[2], 10);
      let year = parseInt(dateMatch[3], 10);
      
      if (year < 100) {
        year = year <= 50 ? 2000 + year : 1900 + year;
      }
      
      // Determina se la data è ambigua (entrambi <= 12)
      if (part1 > 12) {
        // Formato DD/MM: part1 è il giorno
        const date = new DateConstructor(DateConstructor.UTC(year, part2 - 1, part1));
        if (!isNaN(date.getTime()) && date.getUTCFullYear() === year && 
            date.getUTCMonth() === part2 - 1 && date.getUTCDate() === part1) {
          return `${year}-${String(part2).padStart(2, '0')}-${String(part1).padStart(2, '0')}`;
        }
        return null;
      } else if (part2 > 12) {
        // Formato MM/DD: part1 è il mese
        const date = new DateConstructor(DateConstructor.UTC(year, part1 - 1, part2));
        if (!isNaN(date.getTime()) && date.getUTCFullYear() === year && 
            date.getUTCMonth() === part1 - 1 && date.getUTCDate() === part2) {
          return `${year}-${String(part1).padStart(2, '0')}-${String(part2).padStart(2, '0')}`;
        }
        return null;
      } else {
        // Entrambi <= 12: prova ENTRAMBI i formati
        const dateDDMM = new DateConstructor(DateConstructor.UTC(year, part2 - 1, part1));
        const isValidDDMM = !isNaN(dateDDMM.getTime()) && 
            dateDDMM.getUTCFullYear() === year && 
            dateDDMM.getUTCMonth() === part2 - 1 && 
            dateDDMM.getUTCDate() === part1 &&
            part2 >= 1 && part2 <= 12 && part1 >= 1 && part1 <= 31;
        
        const dateMMDD = new DateConstructor(DateConstructor.UTC(year, part1 - 1, part2));
        const isValidMMDD = !isNaN(dateMMDD.getTime()) && 
            dateMMDD.getUTCFullYear() === year && 
            dateMMDD.getUTCMonth() === part1 - 1 && 
            dateMMDD.getUTCDate() === part2 &&
            part1 >= 1 && part1 <= 12 && part2 >= 1 && part2 <= 31;
        
        // Se entrambi sono validi e abbiamo una data di riferimento, scegli quella più logica
        if (isValidDDMM && isValidMMDD && referenceDate) {
          const refDate = new DateConstructor(referenceDate);
          const refDDMM = dateDDMM.getTime();
          const refMMDD = dateMMDD.getTime();
          const refTime = refDate.getTime();
          
          // Se una interpretazione è precedente alla data di riferimento e l'altra è successiva,
          // preferisci quella successiva (più logica per date di uscita)
          if (refDDMM < refTime && refMMDD >= refTime) {
            return `${year}-${String(part1).padStart(2, '0')}-${String(part2).padStart(2, '0')}`;
          } else if (refMMDD < refTime && refDDMM >= refTime) {
            return `${year}-${String(part2).padStart(2, '0')}-${String(part1).padStart(2, '0')}`;
          }
          // Altrimenti preferisci DD/MM (default)
        }
        
        if (isValidDDMM && isValidMMDD) {
          // Preferisci DD/MM per default
          return `${year}-${String(part2).padStart(2, '0')}-${String(part1).padStart(2, '0')}`;
        } else if (isValidMMDD) {
          return `${year}-${String(part1).padStart(2, '0')}-${String(part2).padStart(2, '0')}`;
        } else if (isValidDDMM) {
          return `${year}-${String(part2).padStart(2, '0')}-${String(part1).padStart(2, '0')}`;
        }
      }
    }
  }
  
  return null;
}

function parseDate(value: any): string | null {
  if (!value) return null;
  
  if (value instanceof DateConstructor) {
    if (!isNaN(value.getTime())) {
      const year = value.getUTCFullYear();
      const month = value.getUTCMonth() + 1;
      const day = value.getUTCDate();
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const dateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (dateMatch) {
      const part1 = parseInt(dateMatch[1], 10);
      const part2 = parseInt(dateMatch[2], 10);
      let year = parseInt(dateMatch[3], 10);
      
      if (year < 100) {
        year = year <= 50 ? 2000 + year : 1900 + year;
      }
      
      let month: number;
      let day: number;
      
      // Determina il formato: DD/MM/YYYY o MM/DD/YY
      // Se part1 > 12, è sicuramente DD/MM (giorno > 12)
      // Se part1 <= 12 e part2 > 12, è MM/DD (mese, giorno > 12)
      // Se entrambi <= 12, prova ENTRAMBI i formati e scegli quello valido
      
      if (part1 > 12) {
        // Formato DD/MM: part1 è il giorno, part2 è il mese
        day = part1;
        month = part2;
      } else if (part2 > 12) {
        // Formato MM/DD: part1 è il mese, part2 è il giorno
        month = part1;
        day = part2;
      } else {
        // Entrambi <= 12: prova ENTRAMBI i formati e scegli quello valido
        // Prova prima DD/MM
        let dateDDMM = new DateConstructor(DateConstructor.UTC(year, part2 - 1, part1));
        let isValidDDMM = !isNaN(dateDDMM.getTime()) && 
            dateDDMM.getUTCFullYear() === year && 
            dateDDMM.getUTCMonth() === part2 - 1 && 
            dateDDMM.getUTCDate() === part1 &&
            part2 >= 1 && part2 <= 12 && part1 >= 1 && part1 <= 31;
        
        // Prova poi MM/DD
        let dateMMDD = new DateConstructor(DateConstructor.UTC(year, part1 - 1, part2));
        let isValidMMDD = !isNaN(dateMMDD.getTime()) && 
            dateMMDD.getUTCFullYear() === year && 
            dateMMDD.getUTCMonth() === part1 - 1 && 
            dateMMDD.getUTCDate() === part2 &&
            part1 >= 1 && part1 <= 12 && part2 >= 1 && part2 <= 31;
        
        // Se entrambi sono validi, preferisci DD/MM (formato europeo standard)
        // MA: se abbiamo una data di ingresso di riferimento e una interpretazione porta a una data
        // precedente all'ingresso mentre l'altra è successiva, preferisci quella successiva
        if (isValidDDMM && isValidMMDD) {
          // Preferisci DD/MM per default (formato standard nel CSV)
          day = part1;
          month = part2;
          // TODO: In futuro, se abbiamo contesto (data ingresso), verifica quale interpretazione
          // è più logica (data uscita >= data ingresso)
        } else if (isValidMMDD) {
          month = part1;
          day = part2;
        } else if (isValidDDMM) {
          day = part1;
          month = part2;
        } else {
          // Nessuno valido, prova comunque DD/MM come default
          day = part1;
          month = part2;
        }
      }
      
      // Valida che mese e giorno siano validi
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
      }
      
      const date = new DateConstructor(DateConstructor.UTC(year, month - 1, day));
      if (!isNaN(date.getTime()) && 
          date.getUTCFullYear() === year && 
          date.getUTCMonth() === month - 1 && 
          date.getUTCDate() === day) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    
    // Fallback: prova a parsare con Date nativo
    const date = new DateConstructor(trimmed);
    if (!isNaN(date.getTime())) {
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const day = date.getUTCDate();
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  }
  
  if (typeof value === 'number') {
    const excelEpoch = new DateConstructor(DateConstructor.UTC(1899, 11, 30));
    const date = new DateConstructor(excelEpoch.getTime() + value * 86400000);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  
  return null;
}

function extractNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value.replace(/[^\d.,-]/g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function extractText(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function isValidVerificaColonna(verificaCol: string): boolean {
  if (!verificaCol || verificaCol.trim().length === 0) return false;
  const trimmed = verificaCol.trim();
  const pattern = /^[\d.,]+\s*-\s*.+/;
  if (!pattern.test(trimmed)) {
    return false;
  }
  const parts = trimmed.split(/\s*-\s*/);
  if (parts.length < 2) return false;
  const firstPart = parts[0].trim();
  const secondPart = parts[1].trim();
  const firstPartNumbers = firstPart.replace(/[.,]/g, '');
  const isValid = /^\d+$/.test(firstPartNumbers) && secondPart.length > 0;
  return isValid;
}

function isValidDocumentNumber(docNum: string): boolean {
  if (!docNum || docNum.trim().length === 0) return false;
  const trimmed = docNum.trim();
  const patternWithSlash = /^\d{4}\/\d{4}$/;
  if (patternWithSlash.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Parsa un file CSV e restituisce documenti e righe
 * Separatore: punto e virgola (;)
 */
export async function parseCSVFile(
  fileUri: string,
  onProgress?: (progress: ParseProgress) => void
): Promise<ExcelParseResult> {
  // Sistema di logging dettagliato per file di log
  // Inizializza IMMEDIATAMENTE per catturare anche errori molto precoci
  const detailedLog: string[] = [];
  
  // Funzione di logging sicura che non può fallire
  const logEntry = (message: string, data?: any) => {
    try {
      const timestamp = new DateConstructor().toISOString();
      const logLine = `[${timestamp}] ${message}`;
      detailedLog.push(logLine);
      if (data !== undefined) {
        try {
          detailedLog.push(`  Data: ${JSON.stringify(data, null, 2)}`);
        } catch (e) {
          detailedLog.push(`  Data: [Impossibile serializzare: ${String(data)}]`);
        }
      }
      // Mantieni anche console.log per debugging immediato (ma non può fallire)
      try {
        console.log(message, data || '');
      } catch (e) {
        // Ignora errori di console.log
      }
    } catch (e) {
      // Se anche il logging fallisce, prova almeno a salvare un messaggio minimo
      try {
        detailedLog.push(`[ERRORE LOGGING] ${message}`);
      } catch (e2) {
        // Se anche questo fallisce, non possiamo fare altro
      }
    }
  };
  
  // Log iniziale IMMEDIATO per tracciare l'inizio
  try {
    logEntry('═══════════════════════════════════════════════════════════════');
    logEntry('INIZIO PARSING CSV');
    logEntry('═══════════════════════════════════════════════════════════════');
    logEntry('File URI:', fileUri);
    logEntry('onProgress presente:', !!onProgress);
    logEntry('Timestamp inizio:', new DateConstructor().toISOString());
  } catch (e) {
    // Se anche il logging iniziale fallisce, almeno prova a salvare qualcosa
    detailedLog.push(`[ERRORE LOGGING INIZIALE] ${String(e)}`);
  }
  
  const result: ExcelParseResult = {
    documents: [],
    documentRows: [],
    errors: [],
    skippedRows: 0
  };

  try {
    logEntry('Risultato inizializzato');
  } catch (e) {
    // Ignora errori di logging
  }

  // Wrapper globale per catturare qualsiasi errore di inizializzazione
  try {
    // Log informazioni ambiente
    try {
      logEntry('Informazioni ambiente:', {
        hasWindow: typeof window !== 'undefined',
        hasDocument: typeof document !== 'undefined',
        hasFileSystem: typeof FileSystem !== 'undefined',
        hasRequire: typeof require !== 'undefined',
        nodeEnv: typeof process !== 'undefined' ? process.env?.NODE_ENV : 'N/A'
      });
      
      // Test getPlatform() all'inizio per verificare che funzioni
      try {
        logEntry('Test getPlatform()...');
        const testPlatform = getPlatform();
        logEntry('✅ getPlatform() funziona:', testPlatform ? `OS=${testPlatform.OS}` : 'null');
      } catch (platformError: any) {
        logEntry('❌ ERRORE getPlatform() durante test:', platformError?.message || String(platformError));
        logEntry('Stack getPlatform():', platformError?.stack || 'N/A');
      }
    } catch (e) {
      // Ignora errori di logging ambiente
    }

    // Fase 1: Leggi il file
    try {
      console.log('🔵 [PARSER] Fase 1: Lettura file...');
    } catch (e) {
      // Ignora errori console.log
    }
    if (onProgress) {
      console.log('🔵 [PARSER] Aggiornamento progresso: reading');
      onProgress({ current: 0, total: 100, stage: 'reading' });
    }
    
    console.log('🔵 [PARSER] Lettura file CSV da URI:', fileUri);
    
    let csvContent: string;
    
    // Se l'URI è un data URI (base64), decodifica il contenuto
    logEntry('Verifica tipo URI...');
    if (fileUri.startsWith('data:')) {
      logEntry('Data URI rilevato, decodifica base64...');
      try {
        // Estrai il base64 dal data URI
        const base64Match = fileUri.match(/base64,(.+)$/);
        logEntry('Base64 match trovato:', !!base64Match);
        if (base64Match && base64Match[1]) {
          logEntry('Lunghezza base64:', base64Match[1].length);
          // Decodifica base64 a stringa (per CSV, leggiamo direttamente come testo)
          if (typeof atob !== 'undefined') {
            logEntry('Usando atob (browser)...');
            // Browser/Web
            csvContent = atob(base64Match[1]);
          } else {
            logEntry('Usando Buffer (React Native)...');
            // React Native - usa Buffer se disponibile
            const Buffer = require('buffer').Buffer;
            csvContent = Buffer.from(base64Match[1], 'base64').toString('utf8');
          }
          logEntry('✅ File CSV letto da data URI, dimensione:', csvContent.length);
        } else {
          throw new Error('Formato data URI non valido per CSV');
        }
      } catch (error: any) {
        logEntry('❌ Errore decodifica data URI:', error?.message || String(error));
        logEntry('Stack:', error?.stack || 'N/A');
        throw new Error(`Impossibile decodificare il file CSV: ${error?.message || String(error)}`);
      }
    } else {
      logEntry('File URI normale, lettura con FileSystem...');
      // Leggi il file usando FileSystem
      try {
        csvContent = await FileSystem.readAsStringAsync(fileUri, {
          encoding: (FileSystem as any).EncodingType?.UTF8 || 'utf8'
        });
        logEntry('✅ File CSV letto, dimensione:', csvContent.length);
      } catch (error: any) {
        logEntry('❌ Errore lettura file:', error?.message || String(error));
        logEntry('Stack:', error?.stack || 'N/A');
        throw new Error(`Impossibile leggere il file: ${error?.message || String(error)}`);
      }
    }

    console.log('🔵 [PARSER] Fase 2: Parsing struttura...');
    if (onProgress) {
      console.log('🔵 [PARSER] Aggiornamento progresso: parsing');
      onProgress({ current: 30, total: 100, stage: 'parsing' });
    }

    // Converti CSV in array di righe
    console.log('🔵 [PARSER] Split contenuto per righe...');
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    console.log('✅ [PARSER] Righe totali trovate (dopo filtro):', lines.length);
    
    if (lines.length < 2) {
      console.error('❌ [PARSER] File CSV vuoto o senza dati');
      result.errors.push('Il file CSV sembra vuoto o non contiene dati');
      return result;
    }

    // La prima riga è l'header
    console.log('🔵 [PARSER] Estrazione header...');
    const header = lines[0].split(';');
    console.log('✅ [PARSER] Header estratto, colonne:', header.length);
    
    // Mappatura colonne CSV (indici 0-based)
    console.log('🔵 [PARSER] Mappatura colonne CSV...');
    const verificaColIndex = 2; // Colonna 2: SCARICHI (contiene "numero - CASILLI")
    const dataIngressoIndex = 7; // Colonna 7: DATA
    const docNumIndex = 9; // Colonna 9: N° DOCUMENTO
    const bancaliIndex = 19; // Colonna 19: Q.TA PLT
    const tipologiaIndex = 21; // Colonna 21: TIPOLOGIA BANCALI
    const noteIndex = 22; // Colonna 22: NOTE
    
    // Colonne uscite (15 uscite totali)
    // Pattern: ogni uscita ha "Q.TA PLT" (bancali) seguito da "DATA" (data)
    const usciteDateColumns = [27, 33, 39, 45, 51, 57, 63, 69, 75, 81, 87, 93, 99, 105, 111];
    const usciteBancaliColumns = [26, 32, 38, 44, 50, 56, 62, 68, 74, 80, 86, 92, 98, 104, 110];
    
    // Crea array di uscite con indici
    const usciteColumns: { index: number; name: string; bancaliIndex: number }[] = [];
    for (let i = 0; i < usciteDateColumns.length; i++) {
      usciteColumns.push({
        index: usciteDateColumns[i],
        name: `uscita${i + 1}`,
        bancaliIndex: usciteBancaliColumns[i]
      });
    }

    console.log('Indici colonne CSV (fissi):', {
      verificaColIndex: `${verificaColIndex} (verifica - formato: numero - CASILLI)`,
      dataIngressoIndex: `${dataIngressoIndex} (data ingresso)`,
      docNumIndex: `${docNumIndex} (numero documento)`,
      bancaliIndex: `${bancaliIndex} (numero bancali ingresso)`,
      tipologiaIndex: `${tipologiaIndex} (tipologia bancali)`,
      noteIndex: `${noteIndex} (note)`,
      usciteColumns: `${usciteColumns.length} uscite`,
      totalRows: lines.length - 1
    });

    if (onProgress) {
      onProgress({ current: 60, total: 100, stage: 'processing' });
    }

    // Mappa dei documenti per numero
    const documentsMap = new Map<string, Document>();
    // Mappa per memorizzare la data di ingresso per ogni documento
    const documentDateMap = new Map<string, string>();
    // Mappa per tracciare se un documento ha almeno una riga con bancali > 0
    const documentHasValidRows = new Map<string, boolean>();
    // TEMPORANEO: Memorizza l'ultima data di ingresso processata (per fallback)
    // TODO: Commentare questa logica in futuro quando non più necessaria
    let ultimaDataIngressoProcessata: string | null = null;
    
    // TEMPORANEO: Memorizza le date delle uscite della riga precedente (per ogni uscita 1-15)
    // TODO: Commentare questa logica in futuro quando non più necessaria
    // Usato per gestire gli 8 errori critici: bancali senza data o date non valide
    const ultimeDateUscitePrecedenti: (string | null)[] = Array(15).fill(null);
    
    const baseId = DateConstructor.now();
    
    // Contatori globali
    const globalDocCounter = { value: 0 };
    const globalRowCounter = { value: 0 };
    let totalSkippedRows = 0;

    console.log('🔵 [PARSER] Inizializzazione strutture dati...');
    
    // Struttura per il debug log
    const debugLog = {
      processed: [] as string[],
      skipped: [] as string[]
    };
    
    // Raccogli errori di validazione per documento
    const validationErrors: ExcelParseResult['validationErrors'] = [];
    const dateFuturePerDocumento = new Map<string, Array<{ data: string; bancali: number; tipologia: string }>>();
    
    // Struttura per tracciare ingressi e uscite per documento (per validazione)
    const documentiIngressi = new Map<string, { bancali: number; dataIngresso: string; tipologia: string; riga: number }[]>();
    const documentiUscite = new Map<string, Array<{ data: string; bancali: number; riga: number; uscitaNum: number }>>();
    
    console.log('✅ [PARSER] Strutture dati inizializzate');

    // Aggiungi header al debug log
    const headerLine = [
      'RIGA',
      'DOCUMENTO',
      'BANCALI_INGRESSO',
      'TIPOLOGIA',
      'DATA_INGRESSO',
      ...Array.from({ length: 15 }, (_, i) => `USCITA_${i + 1}_BANCALI`)
    ].join(' | ');
    debugLog.processed.push(headerLine);

    // Processa le righe (escludi header, inizia da riga 2)
    const totalRows = lines.length - 1;
    console.log(`🔵 [PARSER] Inizio elaborazione ${totalRows} righe CSV`);
    
    // Funzione helper per yield al browser (non bloccare il thread)
    const yieldToBrowser = (): Promise<void> => {
      return new Promise(resolve => {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => resolve(), { timeout: 50 });
        } else {
          setTimeout(() => resolve(), 0);
        }
      });
    };
    
    // Processa le righe in batch per non bloccare il browser
    const BATCH_SIZE = 100; // Processa 100 righe alla volta
    let processedRows = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.trim().length === 0) {
        if (debugLog) {
          debugLog.skipped.push(`RIGA ${i + 1} - MOTIVO: riga vuota o non valida`);
        }
        continue;
      }

      // Yield al browser ogni BATCH_SIZE righe per non bloccare
      if (i % BATCH_SIZE === 0) {
        await yieldToBrowser();
        processedRows += BATCH_SIZE;
        
        // Log ogni 1000 righe per monitorare il progresso
        if (i % 1000 === 0) {
          console.log(`🔵 [PARSER] Elaborate ${i}/${totalRows} righe... (documenti: ${result.documents.length}, righe: ${result.documentRows.length})`);
        }
        
        // Aggiorna progresso ogni batch
        if (onProgress) {
          const progressPercent = 60 + Math.floor((i / totalRows) * 40);
          onProgress({
            current: progressPercent,
            total: 100,
            stage: 'processing'
          });
        }
      }

      // Dichiarare row fuori dal try per renderla accessibile nel catch
      let row: string[] | null = null;
      
      try {
        // Split della riga per punto e virgola
        row = line.split(';');
        
        // Verifica colonna verifica (formato: "numero - CASILLI")
        const verificaCol = extractText(row[verificaColIndex]);
        if (!isValidVerificaColonna(verificaCol)) {
          totalSkippedRows++;
          const motivo = `colonna verifica non valida "${verificaCol}" (atteso formato: "numero - CASILLI")`;
          if (debugLog) {
            debugLog.skipped.push(`RIGA ${i + 1} - MOTIVO: ${motivo}`);
          }
          continue;
        }
        
        // Numero documento
        const docNum = extractText(row[docNumIndex]);
        if (!docNum || !isValidDocumentNumber(docNum)) {
          totalSkippedRows++;
          const motivo = `numero documento non valido "${docNum}" (colonna ${docNumIndex})`;
          if (debugLog) {
            debugLog.skipped.push(`RIGA ${i + 1} - MOTIVO: ${motivo}`);
          }
          continue;
        }

        // Crea o recupera il documento
        let document: Document | undefined;
        if (documentsMap.has(docNum)) {
          document = documentsMap.get(docNum)!;
        } else {
          const newDocument: Document = {
            id: baseId + globalDocCounter.value++,
            numero_documento: docNum
          };
          documentsMap.set(docNum, newDocument);
          result.documents.push(newDocument);
          document = newDocument;
        }

        // Estrai i dati della riga
        // Se la colonna DATA è vuota, usa la data dell'ultima riga processata per lo stesso documento
        let dataIngresso = parseDate(row[dataIngressoIndex]);
        if (!dataIngresso) {
          // Se la colonna DATA è vuota ma abbiamo già processato una riga per questo documento, usa quella data
          if (documentDateMap.has(docNum)) {
            dataIngresso = documentDateMap.get(docNum)!;
          } else {
            // TEMPORANEO: Se non abbiamo data per questo documento, usa la data del documento precedente
            // TODO: Commentare questa sezione quando non più necessaria
            if (ultimaDataIngressoProcessata) {
              dataIngresso = ultimaDataIngressoProcessata;
              documentDateMap.set(docNum, dataIngresso);
              // Log per debug (opzionale, può essere rimosso)
              console.log(`⚠️ Riga ${i + 1} (doc ${docNum}): data ingresso mancante, usata data documento precedente: ${dataIngresso}`);
            } else {
              // Prima riga di questo documento senza data: salta
              totalSkippedRows++;
              const motivo = `data ingresso non valida (colonna ${dataIngressoIndex}, valore: "${row[dataIngressoIndex]}") e nessuna data precedente per questo documento`;
              if (debugLog) {
                debugLog.skipped.push(`RIGA ${i + 1} - DOCUMENTO: ${docNum} - MOTIVO: ${motivo}`);
              }
              result.errors.push(`Riga ${i + 1}: ${motivo}`);
              continue;
            }
          }
        } else {
          // Se la data è presente, aggiorna la mappa per questo documento
          documentDateMap.set(docNum, dataIngresso);
          // TEMPORANEO: Memorizza l'ultima data processata per fallback
          // TODO: Commentare questa riga quando non più necessaria
          ultimaDataIngressoProcessata = dataIngresso;
        }

        // Estrai bancali: gestisci esplicitamente stringhe vuote, null, undefined, "0"
        const bancaliRaw = row[bancaliIndex];
        const bancaliValue = bancaliRaw === null || bancaliRaw === undefined || bancaliRaw === '' 
          ? 0 
          : Math.max(0, Math.floor(extractNumber(bancaliRaw)));
        const bancali = bancaliValue;
        
        // Se bancali = 0 (incluso stringhe vuote "", null, undefined, "0"), controlla se ci sono altre righe già processate per lo stesso documento con bancali > 0
        if (bancali === 0) {
          // Se il documento ha già righe valide (bancali > 0), scarta questa riga
          if (documentHasValidRows.get(docNum) === true) {
            totalSkippedRows++;
            const valoreDisplay = bancaliRaw === null || bancaliRaw === undefined || bancaliRaw === '' 
              ? '""' 
              : `"${bancaliRaw}"`;
            const motivo = `numero bancali è 0 (colonna ${bancaliIndex}, valore: ${valoreDisplay}) e documento ha già righe con bancali > 0`;
            if (debugLog) {
              debugLog.skipped.push(`RIGA ${i + 1} - DOCUMENTO: ${docNum} - MOTIVO: ${motivo}`);
            }
            continue;
          } else {
            // Prima riga di questo documento con bancali = 0: salta (non ha senso processarla)
            totalSkippedRows++;
            const valoreDisplay = bancaliRaw === null || bancaliRaw === undefined || bancaliRaw === '' 
              ? '""' 
              : `"${bancaliRaw}"`;
            const motivo = `numero bancali è 0 (colonna ${bancaliIndex}, valore: ${valoreDisplay})`;
            if (debugLog) {
              debugLog.skipped.push(`RIGA ${i + 1} - DOCUMENTO: ${docNum} - MOTIVO: ${motivo}`);
            }
            continue;
          }
        }
        
        // Se arriviamo qui, bancali > 0: segna che questo documento ha almeno una riga valida
        documentHasValidRows.set(docNum, true);
        
        // Traccia ingresso per validazione
        if (!documentiIngressi.has(docNum)) {
          documentiIngressi.set(docNum, []);
        }
        documentiIngressi.get(docNum)!.push({
          bancali: bancali,
          dataIngresso: dataIngresso,
          tipologia: tipologia,
          riga: i + 1
        });
        
        // Inizializza tracciamento uscite per questo documento
        if (!documentiUscite.has(docNum)) {
          documentiUscite.set(docNum, []);
        }

        // Valida e normalizza la tipologia
        let tipologia = row[tipologiaIndex] 
          ? extractText(row[tipologiaIndex]).trim().toUpperCase()
          : '';
        
        if (!tipologia || tipologia.length === 0) {
          tipologia = '80X120'; // Default
        } else {
          tipologia = tipologia.replace(/\s+/g, '').replace(/[xX]/g, 'X');
          if (tipologia !== '100X120' && tipologia !== '80X120') {
            tipologia = '80X120';
          }
        }
        
        const note = extractText(row[noteIndex]);

        // Processa le uscite (15 uscite totali)
        const uscite: DocumentRow['uscite'] = {};
        const usciteDebug: string[] = [];
        // TEMPORANEO: Memorizza le date delle uscite di questa riga per la prossima iterazione
        // TODO: Commentare questa logica in futuro quando non più necessaria
        const dateUsciteCorrenti: (string | null)[] = Array(15).fill(null);
        
        for (let j = 0; j < usciteColumns.length; j++) {
          const uscitaCol = usciteColumns[j];
          const uscitaValue = row[uscitaCol.index];
          const bancaliValue = row[uscitaCol.bancaliIndex];
          
          // Estrai bancali uscita (anche se non c'è data)
          const bancaliUscita = Math.max(0, Math.floor(extractNumber(bancaliValue)));
          
          let uscitaData: string | null = null;
          let usataDataPrecedente = false;
          
          if (uscitaValue) {
            // TEMPORANEO: Usa parseDateWithContext per date ambigue, considerando la data di ingresso
            // TODO: Commentare questa sezione quando non più necessaria
            uscitaData = parseDateWithContext(uscitaValue, dataIngresso);
            
            // TEMPORANEO: Se la data è non valida o precedente all'ingresso ma ci sono bancali, usa la data della riga precedente
            // TODO: Commentare questa sezione quando non più necessaria
            if (bancaliUscita > 0) {
              if (!uscitaData) {
                // Data non valida ma ci sono bancali: controlla se c'è uno shift di colonna (es. data nella colonna successiva)
                // TEMPORANEO: Fallback per righe con shift di colonna (es. riga 16455 dove la data è nella colonna destinazione)
                // TODO: Commentare questa sezione quando non più necessaria
                const nextColIndex = uscitaCol.index + 1;
                if (nextColIndex < row.length) {
                  const nextColValue = row[nextColIndex];
                  const nextColDate = parseDateWithContext(nextColValue, dataIngresso);
                  if (nextColDate) {
                    // Trovata una data valida nella colonna successiva: probabilmente è la data spostata
                    uscitaData = nextColDate;
                    usataDataPrecedente = false; // Non è la riga precedente, è la colonna successiva
                    console.log(`⚠️ Riga ${i + 1} (doc ${docNum}), Uscita ${j + 1}: data non valida "${uscitaValue}" nella colonna ${uscitaCol.index}, trovata data nella colonna successiva: ${nextColDate}`);
                  } else if (ultimeDateUscitePrecedenti[j]) {
                    // Nessuna data nella colonna successiva: usa data della riga precedente
                    uscitaData = ultimeDateUscitePrecedenti[j];
                    usataDataPrecedente = true;
                    console.log(`⚠️ Riga ${i + 1} (doc ${docNum}), Uscita ${j + 1}: data non valida "${uscitaValue}", usata data riga precedente: ${uscitaData}`);
                  }
                } else if (ultimeDateUscitePrecedenti[j]) {
                  uscitaData = ultimeDateUscitePrecedenti[j];
                  usataDataPrecedente = true;
                  console.log(`⚠️ Riga ${i + 1} (doc ${docNum}), Uscita ${j + 1}: data non valida "${uscitaValue}", usata data riga precedente: ${uscitaData}`);
                }
              } else {
                // Data valida: verifica se è precedente all'ingresso
                const dataIngressoDate = new DateConstructor(dataIngresso);
                const uscitaDataDate = new DateConstructor(uscitaData);
                if (uscitaDataDate < dataIngressoDate) {
                  // Data precedente all'ingresso: controlla se c'è una data valida nella colonna successiva
                  // TEMPORANEO: Fallback per righe con shift di colonna
                  // TODO: Commentare questa sezione quando non più necessaria
                  const nextColIndex = uscitaCol.index + 1;
                  if (nextColIndex < row.length) {
                    const nextColValue = row[nextColIndex];
                    const nextColDate = parseDateWithContext(nextColValue, dataIngresso);
                    if (nextColDate) {
                      // Trovata una data valida nella colonna successiva: probabilmente è la data corretta
                      uscitaData = nextColDate;
                      usataDataPrecedente = false;
                      console.log(`⚠️ Riga ${i + 1} (doc ${docNum}), Uscita ${j + 1}: data uscita (${row[uscitaCol.index]}) precedente ingresso, trovata data nella colonna successiva: ${nextColDate}`);
                    } else if (ultimeDateUscitePrecedenti[j]) {
                      uscitaData = ultimeDateUscitePrecedenti[j];
                      usataDataPrecedente = true;
                      console.log(`⚠️ Riga ${i + 1} (doc ${docNum}), Uscita ${j + 1}: data uscita (${row[uscitaCol.index]}) precedente ingresso, usata data riga precedente: ${uscitaData}`);
                    }
                  } else if (ultimeDateUscitePrecedenti[j]) {
                    uscitaData = ultimeDateUscitePrecedenti[j];
                    usataDataPrecedente = true;
                    console.log(`⚠️ Riga ${i + 1} (doc ${docNum}), Uscita ${j + 1}: data uscita (${row[uscitaCol.index]}) precedente ingresso, usata data riga precedente: ${uscitaData}`);
                  }
                }
              }
            }
          } else {
            // TEMPORANEO: Nessuna data ma ci sono bancali: controlla colonna successiva, poi usa data della riga precedente
            // TODO: Commentare questa sezione quando non più necessaria
            if (bancaliUscita > 0) {
              // Controlla se la data è nella colonna successiva (shift di colonna)
              const nextColIndex = uscitaCol.index + 1;
              if (nextColIndex < row.length) {
                const nextColValue = row[nextColIndex];
                const nextColDate = parseDateWithContext(nextColValue, dataIngresso);
                if (nextColDate) {
                  // Trovata una data valida nella colonna successiva: probabilmente è la data spostata
                  uscitaData = nextColDate;
                  usataDataPrecedente = false;
                  console.log(`⚠️ Riga ${i + 1} (doc ${docNum}), Uscita ${j + 1}: data mancante ma ${bancaliUscita} bancali, trovata data nella colonna successiva: ${nextColDate}`);
                } else if (ultimeDateUscitePrecedenti[j]) {
                  uscitaData = ultimeDateUscitePrecedenti[j];
                  usataDataPrecedente = true;
                  console.log(`⚠️ Riga ${i + 1} (doc ${docNum}), Uscita ${j + 1}: data mancante ma ${bancaliUscita} bancali, usata data riga precedente: ${uscitaData}`);
                }
              } else if (ultimeDateUscitePrecedenti[j]) {
                uscitaData = ultimeDateUscitePrecedenti[j];
                usataDataPrecedente = true;
                console.log(`⚠️ Riga ${i + 1} (doc ${docNum}), Uscita ${j + 1}: data mancante ma ${bancaliUscita} bancali, usata data riga precedente: ${uscitaData}`);
              }
            }
          }
          
          // Validazione: bancali senza data
          if (bancaliUscita > 0 && !uscitaData) {
            validationErrors.push({
              documento: docNum,
              tipo: 'bancali_senza_data',
              dettagli: `Uscita ${j + 1}: ${bancaliUscita} bancali ${tipologia} senza data (riga ${i + 1})`,
              riga: i + 1
            });
            console.warn(`⚠️ Riga ${i + 1} (doc ${docNum}): Uscita ${j + 1} ha ${bancaliUscita} bancali ma nessuna data valida`);
          }
          
          // Validazione: data senza bancali
          if (uscitaData && bancaliUscita === 0) {
            validationErrors.push({
              documento: docNum,
              tipo: 'data_senza_bancali',
              dettagli: `Uscita ${j + 1}: data ${uscitaData} presente ma bancali = 0 (riga ${i + 1})`,
              riga: i + 1
            });
            console.warn(`⚠️ Riga ${i + 1} (doc ${docNum}): Uscita ${j + 1} ha data ${uscitaData} ma bancali = 0`);
          }
          
          // Se abbiamo una data valida e bancali > 0, registra l'uscita
          if (uscitaData && bancaliUscita > 0) {
            const dataIngressoDate = new DateConstructor(dataIngresso);
            const uscitaDataDate = new DateConstructor(uscitaData);
            
            // Validazione: data uscita precedente a data ingresso
            if (uscitaDataDate < dataIngressoDate) {
              validationErrors.push({
                documento: docNum,
                tipo: 'data_uscita_precedente_ingresso',
                dettagli: `Uscita ${j + 1}: data ${uscitaData} precedente alla data ingresso ${dataIngresso} (riga ${i + 1})`,
                riga: i + 1
              });
              console.warn(`⚠️ Riga ${i + 1} (doc ${docNum}): Uscita ${j + 1} ha data ${uscitaData} precedente all'ingresso ${dataIngresso}`);
            }
            
            // Controlla se la data è futura (dopo oggi)
            const now = new DateConstructor();
            const today = new DateConstructor(DateConstructor.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
            const uscitaDateUTC = new DateConstructor(DateConstructor.UTC(uscitaDataDate.getUTCFullYear(), uscitaDataDate.getUTCMonth(), uscitaDataDate.getUTCDate(), 23, 59, 59, 999));
            
            if (uscitaDateUTC > today) {
              // Data futura rilevata: raccogli per mostrare alert unico alla fine
              if (!dateFuturePerDocumento.has(docNum)) {
                dateFuturePerDocumento.set(docNum, []);
              }
              dateFuturePerDocumento.get(docNum)!.push({
                data: uscitaData,
                bancali: bancaliUscita,
                tipologia: tipologia
              });
              
              validationErrors.push({
                documento: docNum,
                tipo: 'date_future',
                dettagli: `Uscita ${j + 1}: data ${uscitaData} futura per ${bancaliUscita} bancali ${tipologia} (riga ${i + 1})`,
                riga: i + 1
              });
              
              const messaggio = `Documento ${docNum}: data uscita futura rilevata (${uscitaData}) per ${bancaliUscita} bancali ${tipologia}`;
              result.errors.push(`Riga ${i + 1}: ${messaggio}`);
              console.warn(`⚠️ ${messaggio}`);
              console.log(`🔔 Data futura rilevata: documento=${docNum}, data=${uscitaData}, bancali=${bancaliUscita}, tipologia=${tipologia}, today=${today.toISOString().split('T')[0]}, uscitaDateUTC=${uscitaDateUTC.toISOString().split('T')[0]}`);
              
              // NON registrare l'uscita se è futura (non viene considerata nel calcolo)
              usciteDebug.push(`${bancaliUscita}(futura)`);
              // NON memorizzare la data futura per la prossima riga
              continue;
            }
            
            // Traccia uscita per validazione finale
            documentiUscite.get(docNum)!.push({
              data: uscitaData,
              bancali: bancaliUscita,
              riga: i + 1,
              uscitaNum: j + 1
            });
            
            const giorni = Math.floor((uscitaDataDate.getTime() - dataIngressoDate.getTime()) / (1000 * 60 * 60 * 24));

            uscite[`uscita${j + 1}`] = {
              data: uscitaData,
              bancali: bancaliUscita,
              giorni: giorni > 0 ? giorni : null
            };
            usciteDebug.push(usataDataPrecedente ? `${bancaliUscita}(data prec)` : `${bancaliUscita}`);
            // TEMPORANEO: Memorizza la data per la prossima riga
            // TODO: Commentare questa riga quando non più necessaria
            dateUsciteCorrenti[j] = uscitaData;
          } else {
            // Nessuna data valida o bancali = 0
            usciteDebug.push(bancaliUscita > 0 ? `${bancaliUscita}(no data)` : '0');
            // TEMPORANEO: Mantieni la data precedente anche se non c'è uscita in questa riga
            // TODO: Commentare questa riga quando non più necessaria
            // dateUsciteCorrenti[j] = ultimeDateUscitePrecedenti[j]; // Mantieni la data precedente
          }
        }
        
        // TEMPORANEO: Aggiorna le date delle uscite precedenti per la prossima iterazione
        // TODO: Commentare questa sezione quando non più necessaria
        for (let j = 0; j < 15; j++) {
          if (dateUsciteCorrenti[j]) {
            ultimeDateUscitePrecedenti[j] = dateUsciteCorrenti[j];
          }
        }

        // Crea la riga del documento
        // Verifica che document sia definito (dovrebbe sempre essere così, ma per sicurezza)
        if (!document) {
          totalSkippedRows++;
          const motivo = `document non definito per documento ${docNum}`;
          if (debugLog) {
            debugLog.skipped.push(`RIGA ${i + 1} - MOTIVO: ${motivo}`);
          }
          result.errors.push(`Errore alla riga ${i + 1}: ${motivo}`);
          continue;
        }
        
        const documentRow: DocumentRow = {
          id: baseId + 1000000 + globalRowCounter.value++,
          documento_id: document.id,
          data_ingresso: dataIngresso,
          numero_bancali_ingresso: bancali,
          tipologia_bancali_ingresso: tipologia,
          uscite: uscite,
          note: note
        };

        result.documentRows.push(documentRow);
        
        // LOG DETTAGLIATO PER DEBUG
        if (debugLog) {
          const logLine = [
            `${i + 1}`,                    // nr riga
            docNum,                        // nr documento
            bancali,                       // bancali ingresso
            tipologia,                     // tipologia
            ...usciteDebug                 // uscita 1...fino alla 15 (ogni valore è il numero di bancali usciti)
          ].join(' | ');
          debugLog.processed.push(logLine);
        }
        
        // Progresso aggiornato nel batch processing sopra
      } catch (error) {
        totalSkippedRows++;
        const motivo = `errore durante il parsing: ${error instanceof Error ? error.message : String(error)}`;
        const errorStack = error instanceof Error ? error.stack : 'N/A';
        const errorDetails = {
          riga: i + 1,
          docNum: (row && row[docNumIndex]) ? String(row[docNumIndex]) : 'N/A',
          dataIngresso: (row && row[dataIngressoIndex]) ? String(row[dataIngressoIndex]) : 'N/A',
          bancali: (row && row[bancaliIndex]) ? String(row[bancaliIndex]) : 'N/A',
          tipologia: (row && row[tipologiaIndex]) ? String(row[tipologiaIndex]) : 'N/A',
          verificaCol: (row && row[verificaColIndex]) ? String(row[verificaColIndex]) : 'N/A'
        };
        
        logEntry(`❌ ERRORE RIGA ${i + 1}: ${motivo}`);
        logEntry('Stack trace:', errorStack);
        logEntry('Dettagli riga:', errorDetails);
        logEntry('Row completa (prime 10 colonne):', (row && row.length > 0) ? row.slice(0, 10).join(';') : 'N/A');
        
        if (debugLog) {
          debugLog.skipped.push(`RIGA ${i + 1} - MOTIVO: ${motivo}`);
        }
        result.errors.push(`Errore alla riga ${i + 1}: ${motivo}`);
      }
    }

    if (onProgress) {
      onProgress({ current: 100, total: 100, stage: 'processing' });
    }

    result.skippedRows = totalSkippedRows;
    
    logEntry('═══════════════════════════════════════════════════════════════');
    logEntry('PARSING CSV COMPLETATO');
    logEntry('═══════════════════════════════════════════════════════════════');
    logEntry('Risultati finali:', {
      documenti: result.documents.length,
      righeDocumenti: result.documentRows.length,
      righeSaltate: totalSkippedRows,
      errori: result.errors.length,
      erroriValidazione: result.validationErrors?.length || 0,
      dateFuture: dateFuturePerDocumento.size
    });
    
    // Validazione finale: totale uscite > totale ingressi per documento
    documentiIngressi.forEach((ingressi, docNum) => {
      const totaleIngresso = ingressi.reduce((sum, ing) => sum + ing.bancali, 0);
      const uscite = documentiUscite.get(docNum) || [];
      const totaleUscite = uscite.reduce((sum, usc) => sum + usc.bancali, 0);
      
      if (totaleUscite > totaleIngresso) {
        validationErrors.push({
          documento: docNum,
          tipo: 'uscite_superiori_ingresso',
          dettagli: `Totale uscite (${totaleUscite}) superiore al totale ingresso (${totaleIngresso})`,
          riga: ingressi[0]?.riga || 0
        });
        console.warn(`⚠️ Documento ${docNum}: totale uscite (${totaleUscite}) > totale ingresso (${totaleIngresso})`);
      }
    });
    
    // Aggiungi informazioni sulle date future al risultato (per compatibilità)
    if (dateFuturePerDocumento.size > 0) {
      result.dateFuture = Array.from(dateFuturePerDocumento.entries()).map(([docNum, dateFuture]) => ({
        documento: docNum,
        dateFuture: dateFuture
      }));
      
      console.log(`⚠️ Trovati ${dateFuturePerDocumento.size} documenti con date uscita future`);
    }
    
    // Aggiungi tutti gli errori di validazione al risultato
    if (validationErrors.length > 0) {
      result.validationErrors = validationErrors;
      console.log(`⚠️ Trovati ${validationErrors.length} errori di validazione`);
    }

    // Genera e scarica il file di log dettagliato
    try {
      const timestamp = new DateConstructor().toISOString().replace(/[:.]/g, '-');
      const logFileName = `parser-debug-${timestamp}.log`;
      
      // Combina tutti i log in un unico file
      const fullLogContent = [
        '═══════════════════════════════════════════════════════════════',
        '  LOG DETTAGLIATO PARSER CSV',
        '═══════════════════════════════════════════════════════════════',
        '',
        'LOG DETTAGLIATO (tutte le fasi):',
        '─'.repeat(70),
        ...detailedLog,
        '',
        '─'.repeat(70),
        '',
        'DEBUG LOG CSV - RIGHE PROCESSATE:',
        '─'.repeat(70),
        `Totale righe processate: ${debugLog.processed.length - 1}`,
        `Totale righe saltate: ${debugLog.skipped.length}`,
        '',
        'RIGHE PROCESSATE (prime 100):',
        '─'.repeat(70),
        ...debugLog.processed.slice(0, 100), // Prime 100 righe processate
        debugLog.processed.length > 100 ? `\n... e altre ${debugLog.processed.length - 100} righe processate` : '',
        '',
        '─'.repeat(70),
        '',
        'RIGHE SALTATE (con motivazione):',
        '─'.repeat(70),
        ...debugLog.skipped,
        '',
        '═══════════════════════════════════════════════════════════════',
        '  FINE LOG DETTAGLIATO',
        '═══════════════════════════════════════════════════════════════'
      ].join('\n');

      // Ottieni Platform in modo sicuro
      let Platform: { OS: string } | null = null;
      try {
        Platform = getPlatform();
        logEntry('Platform ottenuto:', Platform ? `OS=${Platform.OS}` : 'null/undefined');
      } catch (e: any) {
        logEntry('⚠️ Errore ottenendo Platform:', e?.message || String(e));
        Platform = null;
      }
      
      // Prova a scaricare/salvare il file di log
      let logSaved = false;
      try {
        if (Platform && Platform.OS === 'web') {
          if (typeof document !== 'undefined') {
            const blob = new Blob([fullLogContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = logFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            logEntry(`✅ File di log dettagliato scaricato: ${logFileName}`);
            logSaved = true;
          }
        } else {
          // Su mobile, salva nella directory documenti
          try {
            const documentDir = (FileSystem as any).documentDirectory;
            if (documentDir) {
              const debugFilePath = `${documentDir}${logFileName}`;
              await FileSystem.writeAsStringAsync(debugFilePath, fullLogContent, {
                encoding: (FileSystem as any).EncodingType?.UTF8 || 'utf8'
              });
              logEntry(`✅ File di log dettagliato salvato: ${debugFilePath}`);
              logSaved = true;
            }
          } catch (fsError: any) {
            logEntry('⚠️ Errore salvataggio file su mobile:', fsError?.message || String(fsError));
          }
        }
      } catch (saveError: any) {
        logEntry('⚠️ Errore generico salvataggio log:', saveError?.message || String(saveError));
      }
      
      // Se non è stato salvato, almeno logga un avviso
      if (!logSaved) {
        logEntry('⚠️ File di log non salvato (piattaforma non supportata o errore)');
      }
    } catch (error) {
      logEntry('❌ Errore nella scrittura del file di log:', error instanceof Error ? error.message : String(error));
      console.error('Errore nella scrittura del file di log:', error);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'N/A';
    
    // Aggiungi l'errore al log dettagliato anche in caso di errore globale
    if (typeof detailedLog !== 'undefined') {
      detailedLog.push(`❌ ERRORE GLOBALE: ${errorMessage}`);
      detailedLog.push(`Stack trace: ${errorStack}`);
    }
    
    result.errors.push(`Errore durante la lettura del file: ${errorMessage}`);
    
    // Cerca di salvare il log anche in caso di errore
    try {
      const timestamp = new DateConstructor().toISOString().replace(/[:.]/g, '-');
      const logFileName = `parser-error-${timestamp}.log`;
      const errorLogContent = [
        '═══════════════════════════════════════════════════════════════',
        '  ERRORE DURANTE PARSING CSV',
        '═══════════════════════════════════════════════════════════════',
        '',
        `Errore: ${errorMessage}`,
        `Stack trace: ${errorStack}`,
        '',
        'Log fino al punto di errore:',
        '─'.repeat(70),
        ...(typeof detailedLog !== 'undefined' ? detailedLog : ['Nessun log disponibile']),
        '',
        '═══════════════════════════════════════════════════════════════'
      ].join('\n');
      
      // Prova a salvare il log di errore
      try {
        let Platform: { OS: string } | null = null;
        try {
          Platform = getPlatform();
        } catch (e) {
          // Ignora errori ottenendo Platform
        }
        
        if (Platform && Platform.OS === 'web' && typeof document !== 'undefined') {
          const blob = new Blob([errorLogContent], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = logFileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      } catch (logError) {
        // Se anche il salvataggio del log di errore fallisce, almeno logga in console
        console.error('Impossibile salvare log di errore:', logError);
      }
    } catch (logError) {
      console.error('Impossibile salvare log di errore:', logError);
    }
  }

  return result;
}

