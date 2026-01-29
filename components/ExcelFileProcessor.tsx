import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useWarehouseStore } from "@/store/warehouseStore";
import { colors } from "@/constants/colors";
import { FileText, Upload, AlertCircle } from "lucide-react-native";
// TEMPORANEO: Commentato per testare parser CSV
// import { parseExcelFile } from "@/utils/excelParser";
import { parseCSVFile } from "@/utils/csvParser";
import { createShadowStyle } from "@/utils/shadowStyles";
import * as FileSystem from "expo-file-system";
import ValidationErrorsModal from "./ValidationErrorsModal";

export default function ExcelFileProcessor() {
  const { 
    addUploadedFile, 
    isLoading, 
    setLoading, 
    setError,
    calculateSummaries,
    saveDataToJSON
  } = useWarehouseStore();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);

  const pickDocument = async () => {
    try {
      setLoading(true);
      setError(null);
      setUploadProgress(0);
      setProgressMessage('Selezione file...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "text/plain"],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        setLoading(false);
        return;
      }
      
      const file = result.assets[0];
      
      console.log('File selezionato:', {
        name: file.name,
        size: file.size,
        uri: file.uri,
        mimeType: file.mimeType
      });
      
      // Controllo dimensione file (limite 50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size && file.size > maxSize) {
        Alert.alert(
          "File troppo grande",
          `Il file è troppo grande (${(file.size / 1024 / 1024).toFixed(2)} MB). Dimensione massima: 50 MB.`
        );
        setLoading(false);
        return;
      }
      
      setUploadProgress(0.05);
      setProgressMessage('Lettura file...');
      
      // Gestione file sul web vs mobile
      let fileUri = file.uri;
      
      if (Platform.OS === 'web') {
        // Sul web, expo-document-picker potrebbe restituire un File object nell'asset
        // Prova a leggere il file usando FileReader se disponibile
        try {
          // Verifica se abbiamo accesso al file object tramite l'asset
          const fileAsset = file as any;
          if (fileAsset.file && typeof FileReader !== 'undefined') {
            console.log('File object trovato sul web, conversione in base64...');
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
              reader.onload = () => {
                const result = reader.result as string;
                // Rimuovi il prefisso data:application/vnd...;base64,
                const base64 = result.split(',')[1] || result;
                resolve(base64);
              };
              reader.onerror = () => reject(new Error('Errore lettura file'));
              reader.readAsDataURL(fileAsset.file);
            });
            
            const base64 = await base64Promise;
            // Crea un URI temporaneo per il parser
            fileUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
            console.log('File convertito in base64, dimensione:', base64.length);
          } else {
            // Fallback: prova a usare l'URI direttamente
            console.log('URI file web (fallback):', fileUri);
            // Verifica se l'URI è accessibile
            try {
              const fileInfo = await FileSystem.getInfoAsync(fileUri);
              if (!fileInfo.exists) {
                throw new Error('Il file non esiste o non è accessibile');
              }
            } catch (error) {
              console.error('Errore verifica file web:', error);
              // Se l'URI non funziona, prova a usare fetch per leggere il file
              if (fileUri.startsWith('http://') || fileUri.startsWith('https://') || fileUri.startsWith('blob:')) {
                console.log('Tentativo lettura file tramite fetch...');
                const response = await fetch(fileUri);
                const blob = await response.blob();
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve, reject) => {
                  reader.onload = () => {
                    const result = reader.result as string;
                    const base64 = result.split(',')[1] || result;
                    resolve(base64);
                  };
                  reader.onerror = () => reject(new Error('Errore lettura file'));
                  reader.readAsDataURL(blob);
                });
                const base64 = await base64Promise;
                fileUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
                console.log('File letto tramite fetch, dimensione base64:', base64.length);
              } else {
                throw new Error('Impossibile accedere al file selezionato');
              }
            }
          }
        } catch (error: any) {
          console.error('Errore gestione file web:', error);
          throw new Error(`Impossibile leggere il file: ${error?.message || String(error)}`);
        }
      } else {
        // Su mobile, verifica che il file esista
        try {
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          console.log('Info file:', fileInfo);
          if (!fileInfo.exists) {
            throw new Error('Il file non esiste o non è accessibile');
          }
        } catch (error) {
          console.error('Errore verifica file:', error);
          throw error;
        }
      }
      
      // Parsa il file Excel con callback di progresso
      const parseResult = await parseCSVFile(fileUri, (progress) => {
        const progressPercent = progress.current / progress.total;
        setUploadProgress(0.05 + progressPercent * 0.85); // 5% - 90%
        
        const stageMessages = {
          reading: 'Lettura file...',
          parsing: 'Analisi struttura...',
          processing: `Elaborazione righe: ${progress.current}/${progress.total}...`
        };
        setProgressMessage(stageMessages[progress.stage]);
      });
      
      setUploadProgress(0.9);
      setProgressMessage('Finalizzazione...');
      
      // Gestisci errori di parsing
      if (parseResult.errors.length > 0) {
        const errorMessage = parseResult.errors.slice(0, 5).join('\n');
        const hasMoreErrors = parseResult.errors.length > 5;
        
        Alert.alert(
          "Errori durante l'elaborazione",
          errorMessage + (hasMoreErrors ? `\n\n... e altri ${parseResult.errors.length - 5} errori` : ''),
          [{ text: "OK" }]
        );
      }
      
      // Mostra alert per date future (dopo gli errori, se presenti)
      console.log('🔔 Controllo date future - parseResult.dateFuture:', parseResult.dateFuture);
      console.log('🔔 parseResult.dateFuture?.length:', parseResult.dateFuture?.length);
      
      if (parseResult.dateFuture && parseResult.dateFuture.length > 0) {
        console.log('🔔 ✅ Date future rilevate:', JSON.stringify(parseResult.dateFuture, null, 2));
        
        // Prepara il messaggio con tutti i documenti
        const documentiList: string[] = [];
        let totaleBancali = 0;
        
        parseResult.dateFuture.forEach((doc) => {
          const dateList = doc.dateFuture.map(d => `    • ${d.data}: ${d.bancali} bancali ${d.tipologia}`).join('\n');
          const bancaliDoc = doc.dateFuture.reduce((sum, d) => sum + d.bancali, 0);
          documentiList.push(`Documento ${doc.documento}:\n${dateList}\n  Totale: ${bancaliDoc} bancali`);
          totaleBancali += bancaliDoc;
        });
        
        const messaggio = `Trovati ${parseResult.dateFuture.length} documento/i con date uscita future:\n\n${documentiList.join('\n\n')}\n\nTotale generale: ${totaleBancali} bancali\n\nQueste uscite non verranno considerate nel calcolo della giacenza.`;
        
        console.log('🔔 Messaggio alert date future preparato:', messaggio);
        
        // Mostra alert dopo che il salvataggio è completato (non subito dopo il parsing)
        // Lo mostriamo dopo il salvataggio per evitare conflitti
        const showDateFutureAlert = () => {
          console.log('🔔 ⚡ CHIAMATA showDateFutureAlert - Mostro alert date future');
          try {
            // Su web, usa window.alert, su mobile usa Alert.alert
            if (Platform.OS === 'web') {
              console.log('🔔 🌐 Piattaforma WEB - uso window.alert');
              window.alert(`Date Uscita Future Rilevate\n\n${messaggio}`);
              console.log('🔔 ✅ window.alert chiamato con successo');
            } else {
              console.log('🔔 📱 Piattaforma MOBILE - uso Alert.alert');
              Alert.alert(
                'Date Uscita Future Rilevate',
                messaggio,
                [{ text: 'OK', onPress: () => console.log('🔔 Alert date future chiuso') }]
              );
              console.log('🔔 ✅ Alert.alert chiamato con successo');
            }
          } catch (error) {
            console.error('🔔 ❌ Errore mostrando alert:', error);
          }
        };
        
        // Salva la funzione per chiamarla dopo il salvataggio
        (global as any).__showDateFutureAlert = showDateFutureAlert;
        console.log('🔔 Funzione showDateFutureAlert salvata in global');
      } else {
        console.log('🔔 ❌ Nessuna data futura rilevata o parseResult.dateFuture è vuoto');
        (global as any).__showDateFutureAlert = null;
      }
      
      // Se non ci sono documenti o righe, avvisa l'utente
      if (parseResult.documents.length === 0 && parseResult.documentRows.length === 0) {
        Alert.alert(
          "Nessun dato trovato",
          "Il file Excel non contiene dati validi o le colonne non sono state riconosciute. Verifica che il file contenga le colonne: numero documento, data ingresso, bancali."
        );
        setLoading(false);
        return;
      }
      
      setUploadProgress(0.7);
      setProgressMessage('Salvataggio dati nel database JSON...');
      
      console.log('Risultato parsing:', {
        documents: parseResult.documents.length,
        documentRows: parseResult.documentRows.length,
        errors: parseResult.errors.length
      });
      
      // Salva direttamente nel JSON (database principale)
      try {
        await saveDataToJSON(parseResult.documents, parseResult.documentRows);
        console.log('✅ Dati salvati nel database JSON');
      } catch (error) {
        console.error('❌ Errore salvataggio JSON database:', error);
        throw new Error(`Impossibile salvare i dati: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      setUploadProgress(0.85);
      setProgressMessage('Calcolo riepiloghi...');
      
      // Aggiungi il file alla lista dei file caricati
      addUploadedFile({
        id: Date.now().toString(),
        name: file.name,
        uri: file.uri,
        size: file.size || 0,
        uploadDate: new Date().toISOString(),
      });
      
      // Ricalcola i riepiloghi dal JSON
      console.log('Chiamata calculateSummaries dal JSON database');
      await calculateSummaries();
      console.log('✅ calculateSummaries completato');
      
      // Mostra errori di validazione dopo che tutto è completato
      if (parseResult.validationErrors && parseResult.validationErrors.length > 0) {
        console.log('🔔 ⚠️ Trovati errori di validazione:', parseResult.validationErrors.length);
        setValidationErrors(parseResult.validationErrors);
        setTimeout(() => {
          setShowValidationErrors(true);
        }, 1000);
      }
      
      setUploadProgress(0.95);
      setProgressMessage('Finalizzazione...');
      
      // Verifica i risultati dopo il calcolo
      const finalState = useWarehouseStore.getState();
      console.log('Risultati calcoli:', {
        entrySummaries: finalState.entrySummaries.length,
        exitSummaries: finalState.exitSummaries.length,
        storageSummaries: finalState.storageSummaries.length,
        totalEntryCost: finalState.entrySummaries.reduce((sum, e) => sum + e.costo_ingresso, 0),
        totalExitCost: finalState.exitSummaries.reduce((sum, e) => sum + e.costi_uscita, 0),
        totalStorageCost: finalState.storageSummaries.reduce((sum, s) => sum + s.costo_storage, 0)
      });
      
      setUploadProgress(1);
      setProgressMessage('Completato!');
      
      // Piccola pausa per mostrare il 100%
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Mostra il risultato con alert
      const successMessage = `File elaborato con successo!\n\n` +
        `📄 Documenti: ${parseResult.documents.length}\n` +
        `📋 Righe: ${parseResult.documentRows.length}` +
        (parseResult.skippedRows > 0 ? `\n⚠️ Righe scartate: ${parseResult.skippedRows}` : '') +
        (parseResult.errors.length > 0 ? `\n\n⚠️ Attenzione: ${parseResult.errors.length} errori durante l'elaborazione` : '') +
        `\n\n💾 Dati salvati nel database JSON` +
        `\n📊 Vai nella Dashboard per vedere i risultati!`;
      
      Alert.alert("✅ File Elaborato", successMessage, [{ text: "OK" }]);
      
    } catch (error) {
      console.error("Errore durante la selezione del documento:", error);
      const errorMessage = error instanceof Error ? error.message : "Errore sconosciuto";
      setError(`Impossibile caricare il file: ${errorMessage}`);
      Alert.alert(
        "Errore di caricamento", 
        `Impossibile caricare il file.\n\n${errorMessage}`,
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  };
  

  return (
    <>
      <ValidationErrorsModal
        visible={showValidationErrors}
        errors={validationErrors}
        onClose={() => setShowValidationErrors(false)}
      />
      <View style={styles.container}>
      <View style={styles.header}>
        <FileText color={colors.primary} size={24} />
        <Text style={styles.title}>Elabora File</Text>
      </View>
      
      <Text style={styles.description}>
        Carica il tuo file Excel o csv del magazzino per elaborare ingressi, uscite e dati di stoccaggio.
        Il sistema eviterà di duplicare le righe dei documenti esistenti.
      </Text>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {progressMessage || 'Elaborazione file...'} {Math.round(uploadProgress * 100)}%
          </Text>
          {uploadProgress > 0 && (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${uploadProgress * 100}%` }]} />
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity style={styles.uploadButton} onPress={pickDocument}>
          <Upload color={colors.card} size={20} />
          <Text style={styles.uploadButtonText}>Carica File</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.infoContainer}>
        <AlertCircle color={colors.info} size={16} />
        <Text style={styles.infoText}>
          Formati supportati: .xls, .xlsx, .csv
        </Text>
      </View>
    </View>
    </>
  );
}

const shadowStyle = createShadowStyle("#000", { width: 0, height: 2 }, 0.1, 4, 2);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...shadowStyle,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    color: colors.darkGray,
    marginBottom: 16,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  loadingText: {
    marginTop: 8,
    color: colors.darkGray,
    fontSize: 14,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: colors.lightGray,
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  infoText: {
    fontSize: 12,
    color: colors.darkGray,
    marginLeft: 6,
  },
});