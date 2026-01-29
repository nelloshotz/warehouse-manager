import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createStorage } from "@/utils/storage";
import { Document, DocumentRow, EntrySummary, ExitSummary, StorageSummary, UploadedFile } from "@/types/warehouse";
import { calculateEquivalence } from "@/utils/calculations";
import { useSettingsStore } from "./settingsStore";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

interface WarehouseState {
  documents: Document[];
  documentRows: DocumentRow[];
  entrySummaries: EntrySummary[];
  exitSummaries: ExitSummary[];
  storageSummaries: StorageSummary[];
  uploadedFiles: UploadedFile[];
  isLoading: boolean;
  error: string | null;
  lastClearTimestamp: number; // Timestamp dell'ultima pulizia per evitare duplicati
  
  // Azioni
  addDocument: (document: Document) => void;
  addDocumentRow: (row: DocumentRow) => void;
  addUploadedFile: (file: UploadedFile) => void;
  removeUploadedFile: (fileId: string) => void;
  calculateSummaries: () => void;
  calculateProjectedStorage: (currentStock: number, monthKey: string) => number;
  getDocumentsByMonth: (monthKey: string) => Document[];
  getDocumentRowsByMonth: (monthKey: string, type: 'entry' | 'exit') => DocumentRow[];
  getDocumentReport: (numeroDocumento: string) => Promise<{
    document: Document | null;
    rows: DocumentRow[];
    totalIngresso: number;
    totalUscite: number;
    bancaliRimanenti: number;
    costiIngresso: number;
    costiUscita: number;
    costiStoccaggio: number;
    tutteUscite: Array<{ data: string; bancali: number; giorni: number | null }>;
  } | null>;
  getStorageDetailsByMonth: (monthKey: string) => Promise<{
    pallets100x120: number;
    equivalentPallets: number;
    pallets80x120: number;
    totalPallets: number;
  }>;
  clearData: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  // Funzioni per gestire il JSON come database
  saveDataToJSON: (documents: Document[], documentRows: DocumentRow[]) => Promise<void>;
  loadDataFromJSON: () => Promise<{ documents: Document[]; documentRows: DocumentRow[] } | null>;
  updateJSONFromStore: () => Promise<void>;
  loadJSONFromString: (jsonString: string) => Promise<void>;
  getJSONAsString: () => Promise<string | null>;
  loadJSONFromFile: (fileUri: string) => Promise<void>;
}

export const useWarehouseStore = create<WarehouseState>()(
  persist(
    (set, get) => ({
      documents: [],
      documentRows: [],
      entrySummaries: [],
      exitSummaries: [],
      storageSummaries: [],
      uploadedFiles: [],
      isLoading: false,
      error: null,
      lastClearTimestamp: 0,
      
      addDocument: (document) => {
        const { documents } = get();
        // Controlla se il documento esiste già
        if (!documents.some(doc => doc.numero_documento === document.numero_documento)) {
          console.log('Aggiungo documento allo store:', document.numero_documento);
          set((state) => ({
            documents: [...state.documents, document],
          }));
        } else {
          console.log('Documento già esistente, salto:', document.numero_documento);
        }
      },
      
      addDocumentRow: (row) => {
        const { documentRows, lastClearTimestamp } = get();
        
        // Se lo store è stato appena pulito (negli ultimi 5 secondi), 
        // o se non ci sono righe, aggiungi sempre la riga senza controllare duplicati
        // Questo evita problemi quando si carica un nuovo file subito dopo aver cancellato
        const recentlyCleared = Date.now() - lastClearTimestamp < 5000;
        const isEmpty = documentRows.length === 0;
        
        if (recentlyCleared || isEmpty) {
          // Aggiungi direttamente senza controllo duplicati
          set((state) => ({
            documentRows: [...state.documentRows, row],
          }));
        } else {
          // Controlla se la riga esiste già usando solo l'ID univoco
          // Questo permette di avere più righe con stesso documento, data e bancali
          // ma con differenze in tipologia, note, uscite, ecc.
          const exists = documentRows.some(existingRow => existingRow.id === row.id);
          if (!exists) {
            set((state) => ({
              documentRows: [...state.documentRows, row],
            }));
          } else {
            console.log(`Riga con ID ${row.id} già presente, salto duplicato`);
          }
        }
      },
      
      addUploadedFile: (file) => {
        set((state) => ({
          uploadedFiles: [...state.uploadedFiles, file],
        }));
      },
      
      removeUploadedFile: (fileId) => {
        set((state) => ({
          uploadedFiles: state.uploadedFiles.filter(file => file.id !== fileId),
        }));
      },
      
      getDocumentsByMonth: async (monthKey) => {
        // Carica i dati dal JSON database
        const jsonData = await get().loadDataFromJSON();
        const documents = jsonData?.documents || get().documents;
        const documentRows = jsonData?.documentRows || get().documentRows;
        
        const [year, month] = monthKey.split('-').map(Number);
        
        // Filtra le righe del documento per il mese specificato
        const rowsInMonth = documentRows.filter(row => {
          const date = new Date(row.data_ingresso);
          return date.getFullYear() === year && date.getMonth() + 1 === month;
        });
        
        // Ottieni gli ID dei documenti unici dalle righe filtrate
        const documentIds = [...new Set(rowsInMonth.map(row => row.documento_id))];
        
        // Restituisci i documenti con quegli ID
        return documents.filter(doc => documentIds.includes(doc.id));
      },
      
      getDocumentRowsByMonth: async (monthKey, type) => {
        // Carica i dati dal JSON database
        const jsonData = await get().loadDataFromJSON();
        const documentRows = jsonData?.documentRows || get().documentRows;
        const documents = jsonData?.documents || get().documents;
        
        const [year, month] = monthKey.split('-').map(Number);
        
        if (type === 'entry') {
          // Per gli ingressi, filtra per data_ingresso
          return documentRows.filter(row => {
            const date = new Date(row.data_ingresso);
            return date.getFullYear() === year && date.getMonth() + 1 === month;
          });
        } else {
          // Per le uscite, filtra per data uscita
          const rowsWithExits = documentRows.filter(row => {
            return Object.values(row.uscite).some(uscita => {
              if (!uscita.data) return false;
              const exitDate = new Date(uscita.data);
              return exitDate.getFullYear() === year && exitDate.getMonth() + 1 === month;
            });
          });
          
          // Restituisci le righe con le uscite del mese
          return rowsWithExits;
        }
      },
      
      getDocumentReport: async (numeroDocumento) => {
        // Carica i dati dal JSON database
        const jsonData = await get().loadDataFromJSON();
        
        console.log('=== RICERCA DOCUMENTO ===');
        console.log('Numero documento cercato:', numeroDocumento);
        console.log('JSON caricato:', jsonData ? 'Sì' : 'No');
        
        // Usa i dati dal JSON se disponibili, altrimenti dallo store
        const documents = jsonData?.documents || get().documents;
        const documentRows = jsonData?.documentRows || get().documentRows;
        
        console.log('Documenti dal JSON:', jsonData?.documents?.length || 0);
        console.log('Righe dal JSON:', jsonData?.documentRows?.length || 0);
        console.log('Documenti dallo store:', get().documents.length);
        console.log('Righe dallo store:', get().documentRows.length);
        console.log('Documenti finali usati:', documents.length);
        console.log('Righe finali usate:', documentRows.length);
        
        // Mostra alcuni esempi di numeri documento per debug
        if (documents.length > 0) {
          console.log('Esempi numeri documento (primi 10):');
          documents.slice(0, 10).forEach(doc => {
            console.log(`  - "${doc.numero_documento}"`);
          });
        }
        
        const { costSettings } = useSettingsStore.getState();
        
        // Normalizza il numero documento cercato (rimuovi spazi, trim, normalizza slash)
        const normalizedSearch = numeroDocumento.trim().replace(/\s+/g, '').toUpperCase();
        
        console.log('Numero documento cercato (normalizzato):', normalizedSearch);
        
        // Funzione di normalizzazione per il matching (case-insensitive, rimuovi spazi)
        const normalizeDocNum = (docNum: string): string => {
          return String(docNum).trim().replace(/\s+/g, '').toUpperCase();
        };
        
        // Trova TUTTI i documenti con questo numero (il numero è univoco, ma potrebbero esserci duplicati nello store)
        const matchingDocuments = documents.filter(doc => {
          const docNum = normalizeDocNum(doc.numero_documento);
          const matches = docNum === normalizedSearch;
          if (matches) {
            console.log(`✅ Match trovato: "${doc.numero_documento}" (normalizzato: "${docNum}")`);
          }
          return matches;
        });
        
        console.log(`Documenti trovati con matching esatto: ${matchingDocuments.length}`);
        
        if (matchingDocuments.length === 0) {
          // Seconda prova: matching parziale (case-insensitive)
          const partialMatches = documents.filter(doc => {
            const docNum = normalizeDocNum(doc.numero_documento);
            const matches = docNum.includes(normalizedSearch) || normalizedSearch.includes(docNum);
            if (matches) {
              console.log(`🔍 Match parziale trovato: "${doc.numero_documento}" (normalizzato: "${docNum}")`);
            }
            return matches;
          });
          
          if (partialMatches.length > 0) {
            console.log(`Documenti trovati con matching parziale: ${partialMatches.length}`);
            console.log('Primo documento trovato:', partialMatches[0].numero_documento);
            matchingDocuments.push(...partialMatches);
          }
        }
        
        if (matchingDocuments.length === 0) {
          console.log('Documento non trovato. Documenti disponibili (primi 20):');
          documents.slice(0, 20).forEach(doc => {
            const normalized = normalizeDocNum(doc.numero_documento);
            console.log(`  - Originale: "${doc.numero_documento}" | Normalizzato: "${normalized}" (ID: ${doc.id})`);
          });
          
          // Cerca documenti simili
          const similarDocs = documents.filter(doc => {
            const docNum = normalizeDocNum(doc.numero_documento);
            return docNum.includes(normalizedSearch.substring(0, 4)) || 
                   normalizedSearch.includes(docNum.substring(0, 4));
          });
          
          if (similarDocs.length > 0) {
            console.log(`\nDocumenti simili trovati (${similarDocs.length}):`);
            similarDocs.slice(0, 5).forEach(doc => {
              console.log(`  - "${doc.numero_documento}" (ID: ${doc.id})`);
            });
          }
          
          return null;
        }
        
        // Prendi il primo documento come riferimento (il numero è univoco, quindi tutti hanno lo stesso numero)
        const document = matchingDocuments[0];
        console.log(`Documento trovato: "${document.numero_documento}" (${matchingDocuments.length} documenti con questo numero, ID: ${document.id})`);
        
        if (matchingDocuments.length > 1) {
          console.warn(`ATTENZIONE: Trovati ${matchingDocuments.length} documenti con lo stesso numero "${document.numero_documento}".`);
          console.warn('Questo indica duplicati nello store. Verranno incluse le righe di tutti questi documenti.');
          matchingDocuments.forEach((doc, idx) => {
            console.warn(`  ${idx + 1}. Documento ID: ${doc.id}, numero: "${doc.numero_documento}"`);
          });
        }
        
        // Trova TUTTE le righe di TUTTI i documenti con questo numero documento
        // (perché il numero è univoco, tutte le righe appartengono allo stesso documento logico)
        const allDocumentIds = matchingDocuments.map(doc => doc.id);
        console.log('ID documenti da cercare:', allDocumentIds);
        console.log('Totale righe nello store:', documentRows.length);
        
        // Trova tutte le righe che hanno uno di questi documento_id
        // IMPORTANTE: Usiamo le righe associate tramite documento_id, non filtriamo per numero_documento
        // perché il documento_id è il collegamento corretto, anche se ci sono problemi di integrità dei dati
        const rows = documentRows.filter(row => allDocumentIds.includes(row.documento_id));
        console.log(`Righe trovate con documento_id corrispondente: ${rows.length}`);
        
        if (rows.length > 0) {
          console.log('Prime 5 righe trovate:');
          rows.slice(0, 5).forEach(row => {
            const associatedDoc = documents.find(d => d.id === row.documento_id);
            console.log(`  - Riga ID: ${row.id}, documento_id: ${row.documento_id}, documento numero: "${associatedDoc?.numero_documento || 'NON TROVATO'}", data: ${row.data_ingresso}`);
          });
          
          // Verifica se ci sono discrepanze (per debug)
          const rowsWithDifferentDocNum = rows.filter(row => {
            const associatedDoc = documents.find(d => d.id === row.documento_id);
            if (!associatedDoc) return true;
            const associatedDocNum = normalizeDocNum(associatedDoc.numero_documento);
            return associatedDocNum !== normalizedSearch;
          });
          
          if (rowsWithDifferentDocNum.length > 0) {
            console.warn(`⚠️ ATTENZIONE: ${rowsWithDifferentDocNum.length} righe hanno documento associato con numero diverso dal cercato.`);
            console.warn('Questo indica un possibile problema di integrità dei dati, ma useremo comunque queste righe perché sono associate tramite documento_id.');
            console.warn('Documento cercato:', document.numero_documento);
            console.warn('Esempio documento associato:', documents.find(d => d.id === rowsWithDifferentDocNum[0].documento_id)?.numero_documento);
          }
        }
        
        console.log('Righe finali usate per il report:', rows.length);
        
        if (rows.length === 0) {
          console.log('Nessuna riga valida trovata per questo documento');
          console.log('Verifica: documento_id cercato:', document.id);
          console.log('Numero documento cercato:', document.numero_documento);
          
          // Verifica se ci sono altre righe con documento_id corrispondente ma numero documento diverso
          const rowsWithSameId = documentRows.filter(row => row.documento_id === document.id);
          if (rowsWithSameId.length > 0) {
            console.warn(`Trovate ${rowsWithSameId.length} righe con documento_id corrispondente ma numero documento diverso:`);
            rowsWithSameId.slice(0, 5).forEach(row => {
              const doc = documents.find(d => d.id === row.documento_id);
              console.warn(`  - Riga ID: ${row.id}, documento_id: ${row.documento_id}, documento numero: "${doc?.numero_documento || 'NON TROVATO'}"`);
            });
          }
          
          // Verifica se ci sono altri documenti con lo stesso numero ma ID diverso
          const otherDocsWithSameNum = documents.filter(d => 
            d.numero_documento === document.numero_documento && d.id !== document.id
          );
          if (otherDocsWithSameNum.length > 0) {
            console.warn(`Trovati ${otherDocsWithSameNum.length} altri documenti con lo stesso numero ma ID diversi:`);
            otherDocsWithSameNum.forEach(doc => {
              const docRows = documentRows.filter(row => row.documento_id === doc.id);
              console.warn(`  - Documento ID: ${doc.id}, righe associate: ${docRows.length}`);
            });
          }
          
          // Crea un report vuoto per mostrare almeno il documento
          console.warn('Documento trovato ma senza righe valide associate. Mostro report vuoto.');
          return {
            document,
            rows: [],
            totalIngresso: 0,
            totalUscite: 0,
            bancaliRimanenti: 0,
            costiIngresso: 0,
            costiUscita: 0,
            costiStoccaggio: 0,
            tutteUscite: []
          };
        }
        
        console.log('Righe valide trovate:', rows.length);
        
        // Calcola totali usando SOLO le righe valide di questo documento specifico
        let totalIngresso = 0;
        let totalUscite = 0;
        let bancaliRimanenti = 0;
        let costiIngresso = 0;
        let costiUscita = 0;
        let costiStoccaggio = 0;
        const tutteUscite: Array<{ data: string; bancali: number; giorni: number | null }> = [];
        
        // Raccogli prima tutti i dati per calcolare l'equivalenza totale corretta
        // IMPORTANTE: Se un bancale è congelato, va contato SOLO come congelato (non anche come 100x120 o 80x120)
        let totalBancali100x120 = 0;
        let totalBancali80x120 = 0;
        let totalBancaliCongelato100x120 = 0; // Congelati 100x120
        let totalBancaliCongelato80x120 = 0;  // Congelati 80x120
        const hasCongelato = rows.some(row => row.note.toUpperCase().includes('CONGELATO'));
        
        rows.forEach(row => {
          const is100x120 = row.tipologia_bancali_ingresso.toUpperCase() === '100X120';
          const isCongelato = row.note.toUpperCase().includes('CONGELATO');
          
          totalIngresso += row.numero_bancali_ingresso;
          
          if (isCongelato) {
            // Se è congelato, conta solo come congelato (non anche come 100x120 o 80x120)
            if (is100x120) {
              totalBancaliCongelato100x120 += row.numero_bancali_ingresso;
            } else {
              totalBancaliCongelato80x120 += row.numero_bancali_ingresso;
            }
          } else if (is100x120) {
            totalBancali100x120 += row.numero_bancali_ingresso;
          } else {
            totalBancali80x120 += row.numero_bancali_ingresso;
          }
        });
        
        // Calcola l'equivalenza totale (non per riga singola)
        // IMPORTANTE: Calcola separatamente normali e congelati, anche se sono nello stesso documento
        // Normali: costo_ingresso (3.5€)
        // Congelati: costo_congelato (5.0€)
        const equiv100x120 = totalBancali100x120 > 0 ? calculateEquivalence(totalBancali100x120) : 0;
        const equiv80x120 = totalBancali80x120;
        const equivCongelato100x120 = totalBancaliCongelato100x120 > 0 
          ? calculateEquivalence(totalBancaliCongelato100x120)
          : 0;
        const equivCongelato80x120 = totalBancaliCongelato80x120; // 1:1 per 80x120 congelati
        
        // Calcola i costi separatamente per normali e congelati
        const costiNormali = equiv100x120 * costSettings.costo_ingresso + equiv80x120 * costSettings.costo_ingresso;
        const costiCongelati = (equivCongelato100x120 + equivCongelato80x120) * costSettings.costo_congelato;
        costiIngresso = costiNormali + costiCongelati;
        
        // Equivalenza totale (solo per visualizzazione, non per calcolo costi)
        const equivalenzaTotaleIngresso = equiv100x120 + equiv80x120 + equivCongelato100x120 + equivCongelato80x120;
        
        // Usa SOLO le righe valide per i calcoli di uscite e stoccaggio
        rows.forEach(row => {
          const is100x120 = row.tipologia_bancali_ingresso.toUpperCase() === '100X120';
          const isCongelato = row.note.toUpperCase().includes('CONGELATO');
          
          // Calcola uscite
          let bancaliUsciti = 0;
          Object.entries(row.uscite).forEach(([_, uscita]) => {
            if (uscita.data && uscita.bancali > 0) {
              bancaliUsciti += uscita.bancali;
              tutteUscite.push({
                data: uscita.data,
                bancali: uscita.bancali,
                giorni: uscita.giorni
              });
              
              // Calcola costo uscita
              let equivalenzaUscita = 0;
              if (isCongelato) {
                equivalenzaUscita = is100x120 
                  ? calculateEquivalence(uscita.bancali)
                  : uscita.bancali;
                costiUscita += equivalenzaUscita * costSettings.costo_congelato;
              } else if (is100x120) {
                equivalenzaUscita = calculateEquivalence(uscita.bancali);
                costiUscita += equivalenzaUscita * costSettings.costo_uscita;
              } else {
                equivalenzaUscita = uscita.bancali;
                costiUscita += equivalenzaUscita * costSettings.costo_uscita;
              }
            }
          });
          
          totalUscite += bancaliUsciti;
          
          // Calcola bancali rimanenti
          const rimanenti = row.numero_bancali_ingresso - bancaliUsciti;
          bancaliRimanenti += rimanenti;
          
          // Calcola costi stoccaggio per questa riga
          // IMPORTANTE: Calcola i costi per TUTTI i bancali che sono stati in stoccaggio,
          // non solo quelli rimanenti. Per ogni uscita, calcola i costi fino alla data di uscita.
          const inDate = new Date(row.data_ingresso);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          if (inDate <= today) {
            // Se ci sono uscite, calcola i costi per ogni periodo
            const usciteOrdinate = Object.entries(row.uscite)
              .filter(([_, uscita]) => uscita.data && uscita.bancali > 0)
              .map(([_, uscita]) => ({
                data: new Date(uscita.data),
                bancali: uscita.bancali
              }))
              .sort((a, b) => a.data.getTime() - b.data.getTime());
            
            if (usciteOrdinate.length > 0) {
              // Calcola i costi per ogni periodo tra ingresso e uscite
              let stockAttuale = row.numero_bancali_ingresso;
              
              usciteOrdinate.forEach((uscita, idx) => {
                // Periodo da ingresso (o ultima uscita) a questa uscita
                const dataInizio = idx === 0 ? inDate : usciteOrdinate[idx - 1].data;
                const dataFine = uscita.data;
                const giorni = Math.floor((dataFine.getTime() - dataInizio.getTime()) / (1000 * 60 * 60 * 24));
                
                if (giorni > 0 && stockAttuale > 0) {
                  // Calcola equivalenza per il periodo
                  let equivalenzaStoccaggio = 0;
                  if (is100x120) {
                    equivalenzaStoccaggio = calculateEquivalence(stockAttuale);
                  } else {
                    equivalenzaStoccaggio = stockAttuale;
                  }
                  
                  // Calcola costo stoccaggio per questo periodo
                  costiStoccaggio += giorni * equivalenzaStoccaggio * costSettings.costo_storage;
                }
                
                // Aggiorna stock dopo l'uscita
                stockAttuale = Math.max(0, stockAttuale - uscita.bancali);
              });
              
              // Se ci sono ancora bancali rimanenti, calcola i costi fino ad oggi
              if (stockAttuale > 0) {
                const ultimaUscita = usciteOrdinate[usciteOrdinate.length - 1].data;
                const giorniRimanenti = Math.floor((today.getTime() - ultimaUscita.getTime()) / (1000 * 60 * 60 * 24));
                
                if (giorniRimanenti > 0) {
                  let equivalenzaStoccaggio = 0;
                  if (is100x120) {
                    equivalenzaStoccaggio = calculateEquivalence(stockAttuale);
                  } else {
                    equivalenzaStoccaggio = stockAttuale;
                  }
                  
                  costiStoccaggio += giorniRimanenti * equivalenzaStoccaggio * costSettings.costo_storage;
                }
              }
            } else {
              // Nessuna uscita: calcola i costi dall'ingresso ad oggi
              const giorniStoccaggio = Math.floor((today.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              
              let equivalenzaStoccaggio = 0;
              if (is100x120) {
                equivalenzaStoccaggio = calculateEquivalence(row.numero_bancali_ingresso);
              } else {
                equivalenzaStoccaggio = row.numero_bancali_ingresso;
              }
              
              costiStoccaggio += giorniStoccaggio * equivalenzaStoccaggio * costSettings.costo_storage;
            }
          }
        });
        
        // Ordina le uscite per data
        tutteUscite.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
        
        console.log('=== RIEPILOGO REPORT ===');
        console.log('Documento:', document.numero_documento, 'ID:', document.id);
        console.log('Righe incluse (solo di questo documento):', rows.length);
        console.log('Totali:', {
          ingresso: totalIngresso,
          uscite: totalUscite,
          rimanenti: bancaliRimanenti
        });
        console.log('Costi:', {
          ingresso: costiIngresso,
          uscita: costiUscita,
          stoccaggio: costiStoccaggio
        });
        console.log('=======================');
        
        return {
          document,
          rows: rows, // Usa SOLO le righe valide di questo documento specifico
          totalIngresso,
          totalUscite,
          bancaliRimanenti,
          costiIngresso,
          costiUscita,
          costiStoccaggio,
          tutteUscite
        };
      },
      
      getStorageDetailsByMonth: async (monthKey) => {
        // Carica i dati dal JSON database
        const jsonData = await get().loadDataFromJSON();
        const documentRows = jsonData?.documentRows || get().documentRows;
        
        const [year, month] = monthKey.split('-').map(Number);
        
        // Inizializza i contatori
        let pallets100x120 = 0;
        let pallets80x120 = 0;
        let equivalentPallets = 0;
        let palletsCongelato100x120 = 0;
        let palletsCongelato80x120 = 0;
        let equivalentPalletsCongelato = 0;
        
        // Ottieni la data di riferimento (fine del mese o oggi se è il mese corrente)
        const now = new Date();
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
        const isCurrentMonth = year === today.getUTCFullYear() && month === today.getUTCMonth() + 1;
        const referenceDate = isCurrentMonth 
          ? today 
          : new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)); // Ultimo giorno del mese
        
        let rowsProcessed = 0;
        let rowsWithRemaining = 0;
        let totalIngresso = 0;
        let totalUscite = 0;
        
        // Calcola lo stock attuale alla data di riferimento
        documentRows.forEach(row => {
          const inDate = new Date(row.data_ingresso);
          
          // Salta se l'ingresso è dopo la data di riferimento
          if (inDate > referenceDate) {
            return;
          }
          
          rowsProcessed++;
          totalIngresso += row.numero_bancali_ingresso;
          
          const is100x120 = row.tipologia_bancali_ingresso.toUpperCase() === '100X120';
          const isCongelato = row.note.toUpperCase().includes('CONGELATO');
          let palletsRemaining = row.numero_bancali_ingresso;
          
          // Sottrai tutte le uscite avvenute fino alla data di riferimento (inclusa)
          Object.values(row.uscite).forEach(exit => {
            if (!exit.data) return;
            
            const exitDate = new Date(exit.data);
            
            // Considera solo le uscite fino alla data di riferimento (inclusa)
            if (exitDate <= referenceDate) {
              palletsRemaining -= exit.bancali;
              totalUscite += exit.bancali;
            }
          });
          
          // Conta solo se ci sono bancali rimanenti alla data di riferimento
          if (palletsRemaining > 0) {
            rowsWithRemaining++;
            // IMPORTANTE: Se è congelato, conta solo come congelato (non anche come normale)
            if (isCongelato) {
              if (is100x120) {
                palletsCongelato100x120 += palletsRemaining;
                equivalentPalletsCongelato += calculateEquivalence(palletsRemaining);
              } else {
                palletsCongelato80x120 += palletsRemaining;
                equivalentPalletsCongelato += palletsRemaining; // 1:1 per 80x120 congelati
              }
            } else {
              // Normali
            if (is100x120) {
              pallets100x120 += palletsRemaining;
              equivalentPallets += calculateEquivalence(palletsRemaining);
            } else {
              pallets80x120 += palletsRemaining;
              equivalentPallets += palletsRemaining; // 1:1 per 80x120
              }
            }
          }
        });
        
        // Log per debug
        if (isCurrentMonth) {
          console.log(`\n[getStorageDetailsByMonth] Mese corrente (${monthKey}):`);
          console.log(`  Righe processate: ${rowsProcessed}`);
          console.log(`  Righe con bancali rimanenti: ${rowsWithRemaining}`);
          console.log(`  Totale ingresso: ${totalIngresso}`);
          console.log(`  Totale uscite: ${totalUscite}`);
          console.log(`  Bancali rimanenti calcolati:`);
          console.log(`    - 100x120 normali: ${pallets100x120}`);
          console.log(`    - 80x120 normali: ${pallets80x120}`);
          console.log(`    - 100x120 congelati: ${palletsCongelato100x120}`);
          console.log(`    - 80x120 congelati: ${palletsCongelato80x120}`);
          console.log(`    - Totale fisico: ${pallets100x120 + pallets80x120 + palletsCongelato100x120 + palletsCongelato80x120}`);
          console.log(`    - Totale equivalenti: ${equivalentPallets + equivalentPalletsCongelato}`);
        }
        
        return {
          pallets100x120,
          equivalentPallets,
          pallets80x120,
          totalPallets: pallets100x120 + pallets80x120,
          palletsCongelato100x120,
          palletsCongelato80x120,
          totalPalletsCongelato: palletsCongelato100x120 + palletsCongelato80x120,
          equivalentPalletsCongelato
        };
      },
      
      calculateSummaries: async () => {
        try {
          // Carica i dati dal JSON (database principale)
          const jsonData = await get().loadDataFromJSON();
          
          // Se non c'è JSON, usa i dati dallo store (per retrocompatibilità)
          const documentRows = jsonData?.documentRows || get().documentRows;
          const documents = jsonData?.documents || get().documents;
          
        const { costSettings } = useSettingsStore.getState();
          
          console.log(`calculateSummaries chiamato con ${documentRows.length} righe e ${documents.length} documenti`);
          
          if (documentRows.length === 0) {
            console.warn('ATTENZIONE: Nessuna riga documento trovata per i calcoli!');
            set({
              entrySummaries: [],
              exitSummaries: [],
              storageSummaries: [],
            });
            return;
          }
          
          // Trova il documento di riferimento "2025/7599" per logging dettagliato
          const refDocument = documents.find(doc => doc.numero_documento === '2025/7599');
          const refRows = refDocument 
            ? documentRows.filter(row => row.documento_id === refDocument.id)
            : [];
          
          if (refDocument && refRows.length > 0) {
            console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
            console.log(`║  CALCOLI DETTAGLIATI PER DOCUMENTO 2025/7599                    ║`);
            console.log(`╚════════════════════════════════════════════════════════════════╝`);
            console.log(`Documento ID: ${refDocument.id}`);
            console.log(`Numero righe trovate: ${refRows.length}\n`);
          }
        
        // Calcola i riepiloghi di ingresso
        const entrySummariesMap = new Map<string, EntrySummary>();
        let processedRows = 0;
        let skippedRows = 0;
        const monthKeys = new Set<string>();
        
        // Raggruppa le righe per mese E per documento
        // L'equivalenza viene calcolata sul totale solo se le righe appartengono allo stesso documento
        const monthlyDataByDocument = new Map<string, Map<number, {
          bancali100x120: number;
          bancali80x120: number;
          bancaliCongelato: number;
          hasCongelato: boolean;
          rows: DocumentRow[];
        }>>();
        
        documentRows.forEach(row => {
          processedRows++;
          const date = new Date(row.data_ingresso);
          
          // Verifica che la data sia valida
          if (isNaN(date.getTime())) {
            console.warn('Data ingresso non valida per riga:', row.id, row.data_ingresso);
            skippedRows++;
            return;
          }
          
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthKeys.add(monthKey);
          
          const isCongelato = row.note.toUpperCase().includes('CONGELATO');
          const is100x120 = row.tipologia_bancali_ingresso.toUpperCase() === '100X120';
          
          // LOG DETTAGLIATO PER 2025/7599 - INGRESSI
          const isRefRow = refDocument && row.documento_id === refDocument.id;
          if (isRefRow) {
            console.log(`[2025/7599 INGRESSO] Riga ID ${row.id}:`);
            console.log(`  - Data: ${row.data_ingresso} → Mese: ${monthKey}`);
            console.log(`  - Bancali: ${row.numero_bancali_ingresso} (${row.tipologia_bancali_ingresso})`);
            console.log(`  - Congelato: ${isCongelato ? 'SÌ' : 'NO'}`);
          }
          
          // Raggruppa per mese e documento
          let monthData = monthlyDataByDocument.get(monthKey);
          if (!monthData) {
            monthData = new Map();
            monthlyDataByDocument.set(monthKey, monthData);
          }
          
          let docData = monthData.get(row.documento_id);
          if (!docData) {
            docData = {
              bancali100x120: 0,
              bancali80x120: 0,
              bancaliCongelato100x120: 0, // Congelati 100x120 separati
              bancaliCongelato80x120: 0,   // Congelati 80x120 separati
              hasCongelato: false,
              rows: []
            };
            monthData.set(row.documento_id, docData);
          }
          
          docData.rows.push(row);
          
          // IMPORTANTE: Se un bancale è congelato, va contato SOLO come congelato (non anche come 100x120 o 80x120)
          if (isCongelato) {
            // Se è congelato, conta solo come congelato, separando per tipologia
            if (is100x120) {
              docData.bancaliCongelato100x120 += row.numero_bancali_ingresso;
            } else {
              docData.bancaliCongelato80x120 += row.numero_bancali_ingresso;
            }
            docData.hasCongelato = true;
          } else if (is100x120) {
            docData.bancali100x120 += row.numero_bancali_ingresso;
          } else {
            docData.bancali80x120 += row.numero_bancali_ingresso;
          }
        });
        
        // Calcola equivalenze e costi per ogni mese, raggruppando per documento
        monthlyDataByDocument.forEach((documentsMap, monthKey) => {
          let summary: EntrySummary = {
            mese_ingresso: monthKey,
            numero_bancali_ingresso_100x120: 0,
            equivalenza_100x120: 0,
            numero_bancali_ingresso_80x120: 0,
            totale_bancali: 0,
            costo_ingresso: 0,
            costi_ingresso_normali: 0,
            costi_ingresso_congelati: 0,
            numero_bancali_congelato: 0,
            equivalenza_bancali_congelato: 0,
          };
          
          // Per ogni documento nel mese, calcola l'equivalenza sul totale di quel documento
          documentsMap.forEach((docData, documentoId) => {
            // Calcola equivalenza e costi sul totale per questo documento
            let docEquivalenza100x120 = 0;
            let docEquivalenza80x120 = 0;
            let docEquivalenzaCongelato = 0;
            let docCostoIngresso = 0;
            
            // IMPORTANTE: Calcola separatamente normali e congelati, anche se sono nello stesso documento
            // Normali: costo_ingresso (3.5€)
            // Congelati: costo_congelato (5.0€)
            
            // Calcola equivalenze per normali
            docEquivalenza100x120 = docData.bancali100x120 > 0 
              ? calculateEquivalence(docData.bancali100x120)
              : 0;
            docEquivalenza80x120 = docData.bancali80x120;
            
            // Calcola equivalenze per congelati
            const equivCongelato100x120 = docData.bancaliCongelato100x120 > 0 
              ? calculateEquivalence(docData.bancaliCongelato100x120)
              : 0;
            const equivCongelato80x120 = docData.bancaliCongelato80x120; // 1:1 per 80x120 congelati
            docEquivalenzaCongelato = equivCongelato100x120 + equivCongelato80x120;
            
            // Calcola i costi separatamente per normali e congelati
            const costiNormali = docEquivalenza100x120 * costSettings.costo_ingresso 
              + docEquivalenza80x120 * costSettings.costo_ingresso;
            const costiCongelati = docEquivalenzaCongelato * costSettings.costo_congelato;
            docCostoIngresso = costiNormali + costiCongelati;
            
            // Aggiungi al totale del mese
            summary.numero_bancali_ingresso_100x120 += docData.bancali100x120;
            summary.equivalenza_100x120 += docEquivalenza100x120;
            summary.numero_bancali_ingresso_80x120 += docData.bancali80x120;
            summary.numero_bancali_congelato += (docData.bancaliCongelato100x120 + docData.bancaliCongelato80x120);
            summary.equivalenza_bancali_congelato += docEquivalenzaCongelato;
            summary.totale_bancali += docEquivalenza100x120 + docEquivalenza80x120 + docEquivalenzaCongelato;
            summary.costo_ingresso += docCostoIngresso;
            summary.costi_ingresso_normali += costiNormali;
            summary.costi_ingresso_congelati += costiCongelati;
          });
          
          entrySummariesMap.set(monthKey, summary);
          
          // Log per 2025/7599
          const isRefMonth = refDocument && documentsMap.has(refDocument.id);
          if (isRefMonth) {
            const refDocData = documentsMap.get(refDocument.id);
            if (refDocData) {
              console.log(`[2025/7599 INGRESSO] Riepilogo mese ${monthKey}:`);
              console.log(`  - Documenti nel mese: ${documentsMap.size}`);
              console.log(`  - Righe documento 2025/7599: ${refDocData.rows.length}`);
              console.log(`  - Bancali 100x120: ${refDocData.bancali100x120}`);
              console.log(`  - Bancali 80x120: ${refDocData.bancali80x120}`);
              console.log(`  - Bancali congelato: ${refDocData.bancaliCongelato}`);
              console.log(`  - Costo ingresso documento 2025/7599: €${(refDocData.hasCongelato ? 
                ((refDocData.bancaliCongelato100x120 > 0 ? calculateEquivalence(refDocData.bancaliCongelato100x120) : 0) + refDocData.bancaliCongelato80x120) * costSettings.costo_congelato :
                (refDocData.bancali100x120 > 0 ? calculateEquivalence(refDocData.bancali100x120) : 0) * costSettings.costo_ingresso + refDocData.bancali80x120 * costSettings.costo_ingresso).toFixed(2)}`);
            }
          }
        });
        
        if (refDocument && refRows.length > 0) {
          console.log(`\n[2025/7599] RIEPILOGO INGRESSI PER MESE:`);
          refRows.forEach(row => {
            const date = new Date(row.data_ingresso);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const summary = entrySummariesMap.get(monthKey);
            if (summary) {
              console.log(`  Mese ${monthKey}:`);
              console.log(`    - Totale bancali 100x120: ${summary.numero_bancali_ingresso_100x120}`);
              console.log(`    - Totale bancali 80x120: ${summary.numero_bancali_ingresso_80x120}`);
              console.log(`    - Totale congelati: ${summary.numero_bancali_congelato}`);
              console.log(`    - Costo totale ingresso: €${summary.costo_ingresso.toFixed(2)}`);
            }
          });
        }
        
        console.log(`Ingressi processati: ${processedRows} righe, ${skippedRows} scartate, ${entrySummariesMap.size} mesi unici, mesi: ${Array.from(monthKeys).sort().join(', ')}`);
        
        // Calcola i riepiloghi di uscita
        const exitSummariesMap = new Map<string, ExitSummary>();
        let processedExits = 0;
        let skippedExits = 0;
        const exitMonthKeys = new Set<string>();
        
        documentRows.forEach(row => {
          Object.entries(row.uscite).forEach(([_, uscita]) => {
            if (!uscita.data) return;
            
            processedExits++;
            const date = new Date(uscita.data);
            
            // Verifica che la data sia valida
            if (isNaN(date.getTime())) {
              console.warn('Data uscita non valida per riga:', row.id, uscita.data);
              skippedExits++;
              return;
            }
            
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            exitMonthKeys.add(monthKey);
            
            const isCongelato = row.note.toUpperCase().includes('CONGELATO');
            const is100x120 = row.tipologia_bancali_ingresso.toUpperCase() === '100X120';
            
            // LOG DETTAGLIATO PER 2025/7599 - USCITE
            const isRefRow = refDocument && row.documento_id === refDocument.id;
            if (isRefRow) {
              console.log(`[2025/7599 USCITA] Riga ID ${row.id}:`);
              console.log(`  - Data uscita: ${uscita.data} → Mese: ${monthKey}`);
              console.log(`  - Bancali usciti: ${uscita.bancali} (${row.tipologia_bancali_ingresso})`);
              console.log(`  - Congelato: ${isCongelato ? 'SÌ' : 'NO'}`);
            }
            
            let summary = exitSummariesMap.get(monthKey) || {
              mese: monthKey,
              tot_bancali_100x120: 0,
              equivalenza_100x120: 0,
              tot_bancali_80x120: 0,
              costi_uscita: 0,
              costi_uscita_normali: 0,
              costi_uscita_congelati: 0,
              totale_bancali_uscita: 0,
              tot_bancali_congelato: 0,
              equivalenza_congelato: 0,
            };
            
            let costoUscita = 0;
            let equivalenzaUscita = 0;
            
            if (isCongelato) {
              summary.tot_bancali_congelato += uscita.bancali;
              equivalenzaUscita = is100x120 
                ? calculateEquivalence(uscita.bancali)
                : uscita.bancali;
              summary.equivalenza_congelato += equivalenzaUscita;
              costoUscita = equivalenzaUscita * costSettings.costo_congelato;
              summary.costi_uscita += costoUscita;
              summary.costi_uscita_congelati += costoUscita;
              if (isRefRow) {
                console.log(`  - Equivalenza: ${equivalenzaUscita} (costo congelato: €${costSettings.costo_congelato})`);
                console.log(`  - Costo uscita questa riga: €${costoUscita.toFixed(2)}`);
              }
            } else if (is100x120) {
              summary.tot_bancali_100x120 += uscita.bancali;
              equivalenzaUscita = calculateEquivalence(uscita.bancali);
              summary.equivalenza_100x120 += equivalenzaUscita;
              costoUscita = equivalenzaUscita * costSettings.costo_uscita;
              summary.costi_uscita += costoUscita;
              summary.costi_uscita_normali += costoUscita;
              if (isRefRow) {
                console.log(`  - Equivalenza: ${equivalenzaUscita} (costo uscita: €${costSettings.costo_uscita})`);
                console.log(`  - Costo uscita questa riga: €${costoUscita.toFixed(2)}`);
              }
            } else {
              summary.tot_bancali_80x120 += uscita.bancali;
              equivalenzaUscita = uscita.bancali;
              costoUscita = equivalenzaUscita * costSettings.costo_uscita;
              summary.costi_uscita += costoUscita;
              summary.costi_uscita_normali += costoUscita;
              if (isRefRow) {
                console.log(`  - Equivalenza: ${equivalenzaUscita} (costo uscita: €${costSettings.costo_uscita})`);
                console.log(`  - Costo uscita questa riga: €${costoUscita.toFixed(2)}`);
              }
            }
            
            summary.totale_bancali_uscita += uscita.bancali;
            exitSummariesMap.set(monthKey, summary);
          });
        });
        
        if (refDocument && refRows.length > 0) {
          console.log(`\n[2025/7599] RIEPILOGO USCITE PER MESE:`);
          const exitMonths = new Set<string>();
          refRows.forEach(row => {
            Object.entries(row.uscite).forEach(([_, uscita]) => {
              if (uscita.data) {
                const date = new Date(uscita.data);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                exitMonths.add(monthKey);
              }
            });
          });
          Array.from(exitMonths).sort().forEach(monthKey => {
            const summary = exitSummariesMap.get(monthKey);
            if (summary) {
              console.log(`  Mese ${monthKey}:`);
              console.log(`    - Totale bancali 100x120: ${summary.tot_bancali_100x120}`);
              console.log(`    - Totale bancali 80x120: ${summary.tot_bancali_80x120}`);
              console.log(`    - Totale congelati: ${summary.tot_bancali_congelato}`);
              console.log(`    - Costo totale uscita: €${summary.costi_uscita.toFixed(2)}`);
            }
          });
        }
        
        console.log(`Uscite processate: ${processedExits} uscite, ${skippedExits} scartate, ${exitSummariesMap.size} mesi unici, mesi: ${Array.from(exitMonthKeys).sort().join(', ')}`);
        
        // Calcola i riepiloghi di stoccaggio con la formula corretta:
        // (Numero di bancali equivalenti × Costo di stoccaggio per bancale) × Numero di giorni in stoccaggio
        const storageSummariesMap = new Map<string, StorageSummary>();
        
        // Elabora ogni riga del documento
        documentRows.forEach(row => {
          const inDate = new Date(row.data_ingresso);
          
          // Verifica che la data sia valida
          if (isNaN(inDate.getTime())) {
            console.warn('Data ingresso non valida:', row.data_ingresso);
            return;
          }
          
          // LOG DETTAGLIATO PER 2025/7599 - STOCCAGGIO
          const isRefRow = refDocument && row.documento_id === refDocument.id;
          if (isRefRow) {
            console.log(`\n[2025/7599 STOCCAGGIO] Riga ID ${row.id}:`);
            console.log(`  - Data ingresso: ${row.data_ingresso}`);
            console.log(`  - Bancali ingresso: ${row.numero_bancali_ingresso} (${row.tipologia_bancali_ingresso})`);
            const usciteCount = Object.values(row.uscite).filter(u => u.data && u.bancali > 0).length;
            console.log(`  - Numero uscite: ${usciteCount}`);
          }
          
          // Calcola lo stock iniziale in bancali equivalenti
          const is100x120 = row.tipologia_bancali_ingresso.toUpperCase() === '100X120';
          
          // Tieni traccia dei bancali rimanenti per tipo per un calcolo accurato dell'equivalenza
          let remaining100x120 = is100x120 ? row.numero_bancali_ingresso : 0;
          let remaining80x120 = !is100x120 ? row.numero_bancali_ingresso : 0;
          
          // Raccogli tutte le uscite e ordinale per data
          const uscite = Object.entries(row.uscite)
            .map(([_, uscita]) => ({
              data: uscita.data ? new Date(uscita.data) : null,
              bancali: uscita.bancali,
            }))
            .filter(uscita => uscita.data && !isNaN(uscita.data.getTime()))
            .sort((a, b) => {
              if (!a.data || !b.data) return 0;
              return a.data.getTime() - b.data.getTime();
            });
          
          // Genera tutti i mesi dalla data di ingresso a oggi
          // Usa UTC per evitare problemi di fuso orario (coerente con le date parse dal JSON)
          const now = new Date();
          const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
          const months = [];
          let currentDate = new Date(inDate.getFullYear(), inDate.getMonth(), 1);
          
          while (currentDate <= today) {
            months.push(new Date(currentDate));
            currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
          }
          
          // Per ogni mese, calcola lo stoccaggio
          months.forEach(month => {
            const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
            const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
            
            // Verifica se questo è il mese corrente
            const isCurrentMonth = month.getFullYear() === today.getUTCFullYear() && 
                                   month.getMonth() === today.getUTCMonth();
            const endDay = isCurrentMonth ? today.getUTCDate() : daysInMonth;
            
            // Inizializza il riepilogo del mese se non esiste
            let summary = storageSummariesMap.get(monthKey) || {
              mese: monthKey,
              stock_medio: 0,
              giorni_totali: 0,
              costo_storage: 0,
            };
            
            // Calcola lo stock iniziale per questo mese applicando tutte le uscite precedenti
            // Prima di questo mese
            let stockAtStartOfMonth = remaining100x120 + remaining80x120;
            let equivalentPalletsAtStart = is100x120
              ? calculateEquivalence(remaining100x120)
              : remaining80x120;
            
            // Applica tutte le uscite che sono avvenute prima di questo mese
            const monthStart = new Date(Date.UTC(month.getFullYear(), month.getMonth(), 1));
            uscite.forEach(uscita => {
              if (!uscita.data) return;
              
                // Se l'uscita è avvenuta prima di questo mese, applicala
              if (uscita.data < monthStart) {
                if (isRefRow) {
                  console.log(`    - Uscita PRIMA del mese ${monthKey}: ${uscita.bancali} bancali il ${uscita.data.toISOString().split('T')[0]}`);
                }
                if (is100x120) {
                  remaining100x120 = Math.max(0, remaining100x120 - uscita.bancali);
                } else {
                  remaining80x120 = Math.max(0, remaining80x120 - uscita.bancali);
                }
                // Ricalcola l'equivalenza
                equivalentPalletsAtStart = is100x120
                  ? calculateEquivalence(remaining100x120)
                  : remaining80x120;
                if (isRefRow) {
                  console.log(`      → Stock aggiornato: ${remaining100x120 + remaining80x120} bancali (equiv: ${equivalentPalletsAtStart.toFixed(2)})`);
                }
              }
            });
            
            // Calcola i giorni in questo mese per questa riga
            let startDay = 1;
            if (month.getMonth() === inDate.getUTCMonth() && month.getFullYear() === inDate.getUTCFullYear()) {
              startDay = inDate.getUTCDate();
            }
            
            // LOG DETTAGLIATO PER 2025/7599 - STOCCAGGIO MESE
            if (isRefRow) {
              console.log(`  [Mese ${monthKey}]`);
              console.log(`    - Stock iniziale mese: ${stockAtStartOfMonth} bancali (${remaining100x120} 100x120, ${remaining80x120} 80x120)`);
              console.log(`    - Equivalenza iniziale: ${equivalentPalletsAtStart.toFixed(2)}`);
              console.log(`    - Giorni considerati: dal giorno ${startDay} al giorno ${endDay}`);
            }
            
            // Tieni traccia delle variazioni giornaliere dello stock all'interno del mese
            const dailyStock = Array(daysInMonth + 1).fill(0);
            
            // Inizializza lo stock giornaliero con lo stock all'inizio del mese
            let currentEquivalentPallets = equivalentPalletsAtStart;
            let currentRemaining100x120 = remaining100x120;
            let currentRemaining80x120 = remaining80x120;
            
            for (let day = startDay; day <= endDay; day++) {
              dailyStock[day] = currentEquivalentPallets;
            }
            
            // Applica le uscite che si verificano in questo mese (fino ad oggi se mese corrente)
            const monthEnd = isCurrentMonth 
              ? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999))
              : new Date(Date.UTC(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999));
            uscite.forEach(uscita => {
              if (!uscita.data) return;
              
              // Se l'uscita è avvenuta in questo mese (e fino ad oggi se mese corrente)
              if (uscita.data >= monthStart && uscita.data <= monthEnd) {
                const exitDay = uscita.data.getUTCDate();
                
                // Se siamo nel mese corrente e l'uscita è dopo oggi, salta
                if (isCurrentMonth && exitDay > today.getUTCDate()) {
                  return;
                }
                
                // Calcola quanti bancali equivalenti vengono rimossi
                let exitEquivalentPallets;
                if (is100x120) {
                  // Per i bancali 100x120, dobbiamo ricalcolare l'equivalenza
                  // dei bancali rimanenti dopo l'uscita
                  const beforeExit = currentRemaining100x120;
                  currentRemaining100x120 = Math.max(0, currentRemaining100x120 - uscita.bancali);
                  
                  // Calcola la differenza in bancali equivalenti
                  const beforeEquiv = calculateEquivalence(beforeExit);
                  const afterEquiv = calculateEquivalence(currentRemaining100x120);
                  exitEquivalentPallets = beforeEquiv - afterEquiv;
                } else {
                  // Per i bancali 80x120, è un rapporto 1:1
                  exitEquivalentPallets = uscita.bancali;
                  currentRemaining80x120 = Math.max(0, currentRemaining80x120 - uscita.bancali);
                }
                
                // Aggiorna i bancali equivalenti dopo questa uscita
                currentEquivalentPallets = Math.max(0, currentEquivalentPallets - exitEquivalentPallets);
                
                // Aggiorna lo stock giornaliero dal giorno DOPO l'uscita fino alla fine del periodo considerato
                // Il giorno dell'uscita viene conteggiato con lo stock PRIMA dell'uscita
                const maxDay = isCurrentMonth ? today.getUTCDate() : daysInMonth;
                for (let day = exitDay + 1; day <= maxDay; day++) {
                  dailyStock[day] = currentEquivalentPallets;
                }
                
                if (isRefRow) {
                  console.log(`    - Uscita DURANTE il mese ${monthKey}: ${uscita.bancali} bancali il giorno ${exitDay}`);
                  console.log(`      → Equivalenza rimossa: ${exitEquivalentPallets.toFixed(2)}`);
                  console.log(`      → Stock dopo uscita: ${currentRemaining100x120 + currentRemaining80x120} bancali (equiv: ${currentEquivalentPallets.toFixed(2)})`);
                }
              }
            });
            
            // Calcola i giorni-bancale totali e il costo di stoccaggio per questa riga in questo mese
            // Per il mese corrente, conta solo fino ad oggi
            let totalPalletDays = 0;
            for (let day = startDay; day <= endDay; day++) {
              totalPalletDays += dailyStock[day];
            }
            
            // Calcola lo stock medio per questa riga in questo mese
            const daysActive = endDay - startDay + 1;
            const avgStock = daysActive > 0 ? totalPalletDays / daysActive : 0;
            
            // Calcola il costo di stoccaggio utilizzando la formula corretta:
            // (Numero di bancali equivalenti × Costo di stoccaggio per bancale) × Numero di giorni in stoccaggio
            // Stiamo utilizzando i valori di stock giornalieri per ottenere costi accurati
            const storageCost = totalPalletDays * costSettings.costo_storage;
            
            if (isRefRow) {
              console.log(`    - Stock medio mese: ${avgStock.toFixed(2)} bancali equivalenti`);
              console.log(`    - Giorni totali: ${daysActive}`);
              console.log(`    - Totale giorni-bancale: ${totalPalletDays.toFixed(2)}`);
              console.log(`    - Costo storage questo mese: €${storageCost.toFixed(2)} (${totalPalletDays.toFixed(2)} × €${costSettings.costo_storage})`);
            }
            
            // Aggiorna il riepilogo
            summary.stock_medio += avgStock;
            summary.giorni_totali += daysActive;
            summary.costo_storage += storageCost;
            
            storageSummariesMap.set(monthKey, summary);
            
            // Aggiorna i valori rimanenti per il prossimo mese
            remaining100x120 = currentRemaining100x120;
            remaining80x120 = currentRemaining80x120;
          });
        });
        
        if (refDocument && refRows.length > 0) {
          console.log(`\n[2025/7599] RIEPILOGO STOCCAGGIO PER MESE:`);
          const storageMonths = Array.from(storageSummariesMap.keys()).sort();
          storageMonths.forEach(monthKey => {
            const summary = storageSummariesMap.get(monthKey);
            if (summary && summary.costo_storage > 0) {
              console.log(`  Mese ${monthKey}:`);
              console.log(`    - Stock medio: ${summary.stock_medio.toFixed(2)} bancali equivalenti`);
              console.log(`    - Giorni totali: ${summary.giorni_totali}`);
              console.log(`    - Costo totale storage: €${summary.costo_storage.toFixed(2)}`);
            }
          });
          console.log(`\n╚════════════════════════════════════════════════════════════════╝\n`);
        }
        
          const newEntrySummaries = Array.from(entrySummariesMap.values());
          const newExitSummaries = Array.from(exitSummariesMap.values());
          const newStorageSummaries = Array.from(storageSummariesMap.values());
          
          // Calcola statistiche dettagliate
          const totalBancaliIngresso = newEntrySummaries.reduce((sum, e) => sum + e.totale_bancali, 0);
          const totalBancaliUscita = newExitSummaries.reduce((sum, e) => sum + e.totale_bancali_uscita, 0);
          const totalStorageCost = newStorageSummaries.reduce((sum, s) => sum + s.costo_storage, 0);
          
          console.log(`\n=== RIEPILOGO CALCOLI ===`);
          console.log(`Documenti totali: ${documents.length}`);
          console.log(`Righe documento totali: ${documentRows.length}`);
          console.log(`Documenti senza righe: ${documents.length - new Set(documentRows.map(r => r.documento_id)).size}`);
          console.log(`\nIngressi:`);
          console.log(`  - Riepiloghi mensili: ${newEntrySummaries.length}`);
          console.log(`  - Righe processate: ${processedRows} (${skippedRows} scartate)`);
          console.log(`  - Totale bancali ingresso: ${totalBancaliIngresso}`);
          console.log(`\nUscite:`);
          console.log(`  - Riepiloghi mensili: ${newExitSummaries.length}`);
          console.log(`  - Uscite processate: ${processedExits} (${skippedExits} scartate)`);
          console.log(`  - Totale bancali uscita: ${totalBancaliUscita}`);
          console.log(`\nStoccaggi:`);
          console.log(`  - Riepiloghi mensili: ${newStorageSummaries.length}`);
          console.log(`  - Costo totale stoccaggio: €${totalStorageCost.toFixed(2)}`);
          console.log(`========================\n`);
          
          try {
        set({
              entrySummaries: newEntrySummaries,
              exitSummaries: newExitSummaries,
              storageSummaries: newStorageSummaries,
            });
          } catch (error: any) {
            console.error('Errore durante il salvataggio dei calcoli:', error);
            if (error?.message?.includes('quota') || error?.message?.includes('exceeded')) {
              console.warn('Quota storage superata durante il salvataggio. I calcoli sono stati eseguiti ma non salvati.');
              // I calcoli sono stati eseguiti, ma non possiamo salvarli. Almeno li mostriamo all'utente.
              // Forziamo un aggiornamento dello stato senza persistenza
              set({
                entrySummaries: newEntrySummaries,
                exitSummaries: newExitSummaries,
                storageSummaries: newStorageSummaries,
              });
            } else {
              throw error;
            }
          }
        } catch (error: any) {
          console.error('Errore durante calculateSummaries:', error);
          if (error?.message?.includes('quota') || error?.message?.includes('exceeded')) {
            console.error('QUOTA STORAGE SUPERATA! Pulizia dei dati non essenziali...');
            // Pulisci i riepiloghi vecchi per liberare spazio
            set({
              entrySummaries: [],
              exitSummaries: [],
              storageSummaries: [],
            });
            // Prova a ricalcolare solo con i dati essenziali
            alert('Attenzione: Lo storage locale è pieno. Alcuni dati potrebbero non essere salvati. Prova a cancellare i dati vecchi.');
          }
        }
      },
      
      calculateProjectedStorage: (currentStock, monthKey) => {
        const { costSettings } = useSettingsStore.getState();
        const { documentRows } = get();
        
        // Analizza la chiave del mese per ottenere anno e mese
        const [year, month] = monthKey.split('-').map(Number);
        
        // Ottieni la data corrente (usa UTC per coerenza con le date parse dal JSON)
        const now = new Date();
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        
        // Se questo non è il mese corrente, restituisci 0
        if (today.getUTCFullYear() !== year || today.getUTCMonth() + 1 !== month) {
          return 0;
        }
        
        // Calcola lo stock attuale (oggi) invece di usare stock_medio
        let currentActualStock = 0;
        
        documentRows.forEach(row => {
          const inDate = new Date(row.data_ingresso);
          // Le date dal JSON sono in formato ISO (UTC), quindi usa UTC per i confronti
          const inDateUTC = new Date(Date.UTC(
            inDate.getUTCFullYear(), 
            inDate.getUTCMonth(), 
            inDate.getUTCDate(), 
            0, 0, 0, 0
          ));
          
          // Salta se l'ingresso è futuro
          if (inDateUTC > today) {
            return;
          }
          
          const is100x120 = row.tipologia_bancali_ingresso.toUpperCase() === '100X120';
          let palletsRemaining = row.numero_bancali_ingresso;
          
          // Sottrai tutte le uscite avvenute fino ad oggi (incluso oggi)
          Object.values(row.uscite).forEach(exit => {
            if (!exit.data) return;
            
            const exitDate = new Date(exit.data);
            // Le date dal JSON sono in formato ISO (UTC), quindi usa UTC per i confronti
            const exitDateUTC = new Date(Date.UTC(
              exitDate.getUTCFullYear(), 
              exitDate.getUTCMonth(), 
              exitDate.getUTCDate(), 
              0, 0, 0, 0
            ));
            
            // Considera solo le uscite fino ad oggi (incluso oggi)
            if (exitDateUTC <= today) {
              palletsRemaining -= exit.bancali;
            }
          });
          
          // Calcola l'equivalenza dei bancali rimanenti
          if (palletsRemaining > 0) {
            if (is100x120) {
              currentActualStock += calculateEquivalence(palletsRemaining);
            } else {
              currentActualStock += palletsRemaining; // 1:1 per 80x120
            }
          }
        });
        
        // Calcola i giorni rimanenti nel mese
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const daysRemaining = daysInMonth - today.getUTCDate();
        
        // Calcola il costo di stoccaggio previsto per i giorni rimanenti utilizzando lo stock attuale:
        // (Numero di bancali equivalenti attuali × Costo di stoccaggio per bancale) × Numero di giorni rimanenti
        return currentActualStock * costSettings.costo_storage * daysRemaining;
      },
      
      // Salva i dati nello store come JSON (database principale) - su file system
      saveDataToJSON: async (documents, documentRows) => {
        try {
          const jsonData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            documents: documents,
            documentRows: documentRows,
          };
          
          const jsonString = JSON.stringify(jsonData, null, 2);
          const fileName = 'warehouse-database.json';
          
          if (Platform.OS === 'web') {
            // Sul web, salva in IndexedDB (trattato come file system virtuale)
            const storage = createStorage();
            await storage.setItem('warehouse-database', jsonString);
            console.log('✅ JSON database salvato in IndexedDB');
            
            // Sul web, forza anche il download del file nella cartella Download
            // Il file verrà salvato automaticamente nella cartella Download dell'utente
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log('✅ JSON database scaricato automaticamente nella cartella Download');
            console.log('💡 Suggerimento: Sposta il file in database_json/ per tenerlo nel progetto');
          } else {
            // Su mobile, salva nella directory documenti dell'app
            const documentDir = FileSystem.documentDirectory;
            if (!documentDir) {
              throw new Error('Directory documenti non disponibile');
            }
            
            const fileUri = `${documentDir}${fileName}`;
            await FileSystem.writeAsStringAsync(fileUri, jsonString, {
              encoding: FileSystem.EncodingType.UTF8,
            });
            
            console.log('✅ JSON database salvato su file system:', fileUri);
            
            // Su mobile, prova anche a salvare nella directory cache (più accessibile)
            try {
              const cacheDir = FileSystem.cacheDirectory;
              if (cacheDir) {
                const cacheFileUri = `${cacheDir}${fileName}`;
                await FileSystem.writeAsStringAsync(cacheFileUri, jsonString, {
                  encoding: FileSystem.EncodingType.UTF8,
                });
                console.log('✅ JSON database salvato anche in cache:', cacheFileUri);
              }
            } catch (error) {
              console.warn('⚠️ Impossibile salvare in cache (non critico):', error);
            }
          }
          
          // Aggiorna anche lo store Zustand
          set({
            documents: documents,
            documentRows: documentRows,
          });
          
          console.log('✅ JSON database salvato:', {
            documents: documents.length,
            documentRows: documentRows.length,
            size: `${(jsonString.length / 1024).toFixed(2)} KB`
          });
        } catch (error) {
          console.error('Errore salvataggio JSON database:', error);
          throw error;
        }
      },
      
      // Carica i dati dal JSON (database principale) - da file system (lettura automatica)
      loadDataFromJSON: async () => {
        try {
          const fileName = 'warehouse-database.json';
          let jsonString: string | null = null;
          let source = '';
          
          if (Platform.OS === 'web') {
            // Sul web, leggi da IndexedDB (trattato come file system virtuale)
            const storage = createStorage();
            jsonString = await storage.getItem('warehouse-database');
            source = 'IndexedDB';
            
            // Se non trovato in IndexedDB, prova a leggere dalla cartella database_json/ (solo in sviluppo)
            if (!jsonString && typeof window !== 'undefined') {
              try {
                // Prova a leggere dal percorso relativo database_json/warehouse-database.json
                const response = await fetch('/database_json/warehouse-database.json');
                if (response.ok) {
                  const contentType = response.headers.get('content-type');
                  // Verifica che la risposta sia JSON, non HTML
                  if (contentType && contentType.includes('application/json')) {
                    jsonString = await response.text();
                    // Verifica che la stringa non sia HTML (non inizia con '<')
                    if (jsonString && !jsonString.trim().startsWith('<')) {
                      source = 'database_json folder';
                      console.log('✅ JSON caricato dalla cartella database_json/');
                    } else {
                      console.log('File non è JSON valido (probabilmente HTML)');
                    }
                  }
                }
              } catch (error) {
                // Ignora errore, non critico
                console.log('File non trovato in database_json/ (normale se non presente)');
              }
            }
          } else {
            // Su mobile, leggi dal file system
            const documentDir = FileSystem.documentDirectory;
            if (!documentDir) {
              console.log('Directory documenti non disponibile');
              return null;
            }
            
            const fileUri = `${documentDir}${fileName}`;
            
            // Verifica se il file esiste
            const fileInfo = await FileSystem.getInfoAsync(fileUri);
            if (!fileInfo.exists) {
              console.log('File JSON database non trovato su file system');
              return null;
            }
            
            // Leggi il file
            jsonString = await FileSystem.readAsStringAsync(fileUri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
            source = 'File System';
          }
          
          if (!jsonString) {
            console.log('Nessun JSON database trovato');
            return null;
          }
          
          const jsonData = JSON.parse(jsonString);
          
          // Aggiorna lo store Zustand con i dati dal JSON
          set({
            documents: jsonData.documents || [],
            documentRows: jsonData.documentRows || [],
          });
          
          console.log('✅ JSON database caricato automaticamente:', {
            documents: jsonData.documents?.length || 0,
            documentRows: jsonData.documentRows?.length || 0,
            source: source
          });
          
          return {
            documents: jsonData.documents || [],
            documentRows: jsonData.documentRows || [],
          };
        } catch (error) {
          console.error('Errore caricamento JSON database:', error);
          return null;
        }
      },
      
      // Aggiorna il JSON con i dati attuali dello store
      updateJSONFromStore: async () => {
        const { documents, documentRows } = get();
        await get().saveDataToJSON(documents, documentRows);
      },
      
      // Carica JSON da una stringa (per modifiche manuali)
      loadJSONFromString: async (jsonString) => {
        try {
          const jsonData = JSON.parse(jsonString);
          
          if (!jsonData.documents || !jsonData.documentRows) {
            throw new Error('Formato JSON non valido. Attesi: documents e documentRows');
          }
          
          // Salva nel database JSON
          await get().saveDataToJSON(jsonData.documents, jsonData.documentRows);
          
          // Ricalcola i summaries
          await get().calculateSummaries();
          
          console.log('✅ JSON caricato da stringa e salvato nel database');
        } catch (error) {
          console.error('Errore caricamento JSON da stringa:', error);
          throw error;
        }
      },
      
      // Ottieni il JSON come stringa - da file system o storage
      getJSONAsString: async () => {
        try {
          const fileName = 'warehouse-database.json';
          let jsonString: string | null = null;
          
          if (Platform.OS === 'web') {
            // Sul web, leggi da IndexedDB
            const storage = createStorage();
            jsonString = await storage.getItem('warehouse-database');
          } else {
            // Su mobile, leggi dal file system
            const documentDir = FileSystem.documentDirectory;
            if (documentDir) {
              const fileUri = `${documentDir}${fileName}`;
              const fileInfo = await FileSystem.getInfoAsync(fileUri);
              if (fileInfo.exists) {
                jsonString = await FileSystem.readAsStringAsync(fileUri, {
                  encoding: FileSystem.EncodingType.UTF8,
                });
              }
            }
          }
          
          return jsonString;
        } catch (error) {
          console.error('Errore lettura JSON:', error);
          return null;
        }
      },
      
      // Carica JSON da file (per import manuale)
      loadJSONFromFile: async (fileUri: string) => {
        try {
          let jsonString: string;
          
          if (Platform.OS === 'web') {
            // Sul web, leggi il file usando FileReader
            const response = await fetch(fileUri);
            jsonString = await response.text();
          } else {
            // Su mobile, leggi dal file system
            jsonString = await FileSystem.readAsStringAsync(fileUri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
          }
          
          // Valida e carica il JSON
          const jsonData = JSON.parse(jsonString);
          
          if (!jsonData.documents || !jsonData.documentRows) {
            throw new Error('Formato JSON non valido. Attesi: documents e documentRows');
          }
          
          // Salva nel database JSON
          await get().saveDataToJSON(jsonData.documents, jsonData.documentRows);
          
          // Ricalcola i summaries
          await get().calculateSummaries();
          
          console.log('✅ JSON caricato da file e salvato nel database');
        } catch (error) {
          console.error('Errore caricamento JSON da file:', error);
          throw error;
        }
      },
      
      clearData: async () => {
        console.log('=== PULIZIA DI TUTTI I DATI ===');
        
        const clearTimestamp = Date.now();
        
        try {
          // Pulisci tutti i dati nello stato PRIMA, incluso il timestamp di pulizia
        set({
          documents: [],
          documentRows: [],
          entrySummaries: [],
          exitSummaries: [],
          storageSummaries: [],
          uploadedFiles: [],
            isLoading: false,
            error: null,
            lastClearTimestamp: clearTimestamp,
          });
          
          console.log('Stato in-memory resettato');
          
          // Pulisci lo storage persistente Zustand
          const storage = createStorage();
          await storage.removeItem('warehouse-data');
          
          // Elimina il file JSON dal file system (questo è il database principale)
          const fileName = 'warehouse-database.json';
          
          if (Platform.OS === 'web') {
            // Sul web, elimina da IndexedDB
            await storage.removeItem('warehouse-database');
            console.log('File JSON eliminato da IndexedDB');
            console.log('💡 Ricorda: se hai spostato il file in database_json/, cancellalo manualmente da quella cartella');
          } else {
            // Su mobile, elimina dal file system (directory documenti)
            const documentDir = FileSystem.documentDirectory;
            if (documentDir) {
              const fileUri = `${documentDir}${fileName}`;
              try {
                const fileInfo = await FileSystem.getInfoAsync(fileUri);
                if (fileInfo.exists) {
                  await FileSystem.deleteAsync(fileUri, { idempotent: true });
                  console.log('File JSON eliminato dal file system:', fileUri);
                }
              } catch (error) {
                console.warn('Errore eliminazione file JSON (non critico):', error);
              }
            }
            
            // Prova anche a eliminare dalla directory cache se presente
            try {
              const cacheDir = FileSystem.cacheDirectory;
              if (cacheDir) {
                const cacheFileUri = `${cacheDir}${fileName}`;
                const cacheFileInfo = await FileSystem.getInfoAsync(cacheFileUri);
                if (cacheFileInfo.exists) {
                  await FileSystem.deleteAsync(cacheFileUri, { idempotent: true });
                  console.log('File JSON eliminato anche dalla cache:', cacheFileUri);
                }
              }
            } catch (error) {
              console.warn('Errore eliminazione file JSON dalla cache (non critico):', error);
            }
          }
          
          console.log('File JSON database eliminato con successo');
          
          // Forza un piccolo delay per assicurarsi che lo storage sia completamente pulito
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Verifica che lo stato sia effettivamente vuoto
          const currentState = get();
          const isEmpty = 
            currentState.documents.length === 0 &&
            currentState.documentRows.length === 0 &&
            currentState.entrySummaries.length === 0 &&
            currentState.exitSummaries.length === 0 &&
            currentState.storageSummaries.length === 0 &&
            currentState.uploadedFiles.length === 0;
          
          if (!isEmpty) {
            console.warn('ATTENZIONE: Lo stato non è completamente vuoto dopo la pulizia!');
            console.warn('Stato attuale:', {
              documents: currentState.documents.length,
              documentRows: currentState.documentRows.length,
              entrySummaries: currentState.entrySummaries.length,
              exitSummaries: currentState.exitSummaries.length,
              storageSummaries: currentState.storageSummaries.length,
              uploadedFiles: currentState.uploadedFiles.length,
            });
            
            // Forza un reset completo
            set({
              documents: [],
              documentRows: [],
              entrySummaries: [],
              exitSummaries: [],
              storageSummaries: [],
              uploadedFiles: [],
              isLoading: false,
              error: null,
              lastClearTimestamp: clearTimestamp,
            });
          }
          
          // Ricalcola i summaries (saranno vuoti ma assicura coerenza)
          await get().calculateSummaries();
          
          console.log('Pulizia completata con successo');
          console.log('Stato finale:', {
            documents: get().documents.length,
            documentRows: get().documentRows.length,
            entrySummaries: get().entrySummaries.length,
            exitSummaries: get().exitSummaries.length,
            storageSummaries: get().storageSummaries.length,
            uploadedFiles: get().uploadedFiles.length,
          });
          console.log('==============================');
        } catch (error) {
          console.error('Errore durante la pulizia dei dati:', error);
          // Anche in caso di errore, prova a resettare lo stato
          try {
            set({
              documents: [],
              documentRows: [],
              entrySummaries: [],
              exitSummaries: [],
              storageSummaries: [],
              uploadedFiles: [],
              isLoading: false,
              error: error instanceof Error ? error.message : 'Errore sconosciuto durante la pulizia',
              lastClearTimestamp: clearTimestamp,
            });
          } catch (setError) {
            console.error('Errore durante il reset dello stato:', setError);
          }
          // Non lanciare l'errore, ma loggarlo
          console.error('Errore completo durante clearData:', error);
        }
      },
      
      setLoading: (loading) => {
        set({ isLoading: loading });
      },
      
      setError: (error) => {
        set({ error });
      },
    }),
    {
      name: "warehouse-data",
      storage: createJSONStorage(() => createStorage()),
      // Salva solo i dati essenziali, escludi i riepiloghi calcolati (verranno ricalcolati al caricamento)
      // NOTA: documents e documentRows sono salvati nel JSON database separato
      partialize: (state) => {
        // Limita il numero di file caricati per evitare di superare la quota
        const maxUploadedFiles = 10;
        const limitedUploadedFiles = state.uploadedFiles.slice(-maxUploadedFiles);
        
        return {
          // Non salviamo più documents e documentRows qui, sono nel JSON database
          uploadedFiles: limitedUploadedFiles,
          lastClearTimestamp: state.lastClearTimestamp,
        };
      },
      // Al ripristino, carica i dati dal JSON database
      onRehydrateStorage: () => async (state, error) => {
        if (error) {
          console.error('Errore durante il ripristino dello storage:', error);
          // Se c'è un errore, pulisci lo storage e ricomincia
          if (error.message?.includes('quota') || error.message?.includes('exceeded')) {
            console.warn('Quota storage superata, pulizia dati...');
            const storage = createStorage();
            await storage.removeItem('warehouse-data').catch(console.error);
            await storage.removeItem('warehouse-database').catch(console.error);
          }
        } else if (state) {
          // Carica i dati dal JSON database
          try {
            const jsonData = await state.loadDataFromJSON();
            if (jsonData) {
              console.log('✅ Dati caricati dal JSON database al riavvio');
              // Ricalcola i summaries
              await state.calculateSummaries();
            } else {
              console.log('ℹ️ Nessun JSON database trovato, uso dati dallo store Zustand');
            }
          } catch (error) {
            console.warn('⚠️ Errore caricamento JSON database al riavvio:', error);
          }
        }
      },
    }
  )
);