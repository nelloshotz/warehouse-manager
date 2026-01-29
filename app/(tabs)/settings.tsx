import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Platform } from "react-native";
import { useWarehouseStore } from "@/store/warehouseStore";
import { colors } from "@/constants/colors";
import { Settings, Trash2, X, Download, FileText } from "lucide-react-native";
import CostSettingsForm from "@/components/CostSettingsForm";
import ExcelFileProcessor from "@/components/ExcelFileProcessor";
import UploadedFilesList from "@/components/UploadedFilesList";
import AppLayout from "@/components/AppLayout";
import { createShadowStyle } from "@/utils/shadowStyles";

export default function SettingsScreen() {
  const { clearData, calculateSummaries, getJSONAsString, loadJSONFromString, loadDataFromJSON, loadJSONFromFile } = useWarehouseStore();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [jsonData, setJsonData] = useState<string | null>(null);
  const [loadingJSON, setLoadingJSON] = useState(false);
  
  const handleClearData = () => {
    console.log('handleClearData chiamato - mostro modal di conferma');
    setShowConfirmModal(true);
  };
  
  const handleConfirmClear = async () => {
    console.log('Conferma cancellazione - inizio processo');
    setIsClearing(true);
    setShowConfirmModal(false);
    
    try {
      console.log('Inizio cancellazione dati...');
      
      // Chiama clearData che ora è asincrona
      await clearData();
      
      console.log('clearData completata, verifico lo stato...');
      
      // Attendi un momento per assicurarsi che lo stato sia aggiornato
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verifica che i dati siano stati cancellati
      const state = useWarehouseStore.getState();
      console.log('Stato dopo cancellazione:', {
        documents: state.documents.length,
        documentRows: state.documentRows.length,
        uploadedFiles: state.uploadedFiles.length
      });
      
      const isEmpty = 
        state.documents.length === 0 &&
        state.documentRows.length === 0 &&
        state.uploadedFiles.length === 0;
      
      if (isEmpty) {
        // Ricalcola i summaries per assicurarsi che l'UI si aggiorni
        calculateSummaries();
        console.log('Dati cancellati con successo');
        
        // Usa window.alert su web, Alert.alert su mobile
        const successMessage = Platform.OS === 'web' 
          ? "Successo: Tutti i dati sono stati cancellati con successo.\n\n💡 Ricorda: se hai spostato il file warehouse-database.json nella cartella database_json/, cancellalo manualmente da quella cartella."
          : "Tutti i dati sono stati cancellati con successo.";
        
        if (Platform.OS === 'web') {
          window.alert(successMessage);
        } else {
          Alert.alert("Successo", successMessage);
        }
      } else {
        console.warn('ATTENZIONE: I dati non sono stati completamente cancellati');
        if (Platform.OS === 'web') {
          window.alert("Attenzione: Alcuni dati potrebbero non essere stati cancellati. Prova a ricaricare la pagina.");
        } else {
          Alert.alert(
            "Attenzione", 
            "Alcuni dati potrebbero non essere stati cancellati. Prova a ricaricare la pagina."
          );
        }
      }
    } catch (error) {
      console.error('Errore durante la cancellazione:', error);
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      console.error('Messaggio errore:', errorMessage);
      
      if (Platform.OS === 'web') {
        window.alert(`Errore: Si è verificato un errore durante la cancellazione dei dati:\n\n${errorMessage}`);
      } else {
        Alert.alert(
          "Errore", 
          `Si è verificato un errore durante la cancellazione dei dati:\n\n${errorMessage}`
        );
      }
    } finally {
      setIsClearing(false);
    }
  };
  
  const handleCancelClear = () => {
    console.log('Cancellazione annullata');
    setShowConfirmModal(false);
  };
  
  const handleShowDebug = async () => {
    setLoadingJSON(true);
    setShowDebugModal(true);
    try {
      const json = await getJSONAsString();
      setJsonData(json);
    } catch (error) {
      console.error('Errore caricamento JSON:', error);
      setJsonData(null);
    } finally {
      setLoadingJSON(false);
    }
  };
  
  const handleSaveJSON = async () => {
    if (!jsonData) return;
    
    try {
      await loadJSONFromString(jsonData);
      setShowDebugModal(false);
      if (Platform.OS === 'web') {
        window.alert('✅ JSON salvato e calcoli aggiornati!');
      } else {
        Alert.alert('✅ Successo', 'JSON salvato e calcoli aggiornati!');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      if (Platform.OS === 'web') {
        window.alert(`❌ Errore: ${errorMessage}`);
      } else {
        Alert.alert('❌ Errore', errorMessage);
      }
    }
  };
  
  const handleReloadFromJSON = async () => {
    try {
      await loadDataFromJSON();
      await calculateSummaries();
      if (Platform.OS === 'web') {
        window.alert('✅ Dati ricaricati dal JSON database!');
      } else {
        Alert.alert('✅ Successo', 'Dati ricaricati dal JSON database!');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      if (Platform.OS === 'web') {
        window.alert(`❌ Errore: ${errorMessage}`);
      } else {
        Alert.alert('❌ Errore', errorMessage);
      }
    }
  };
  
  const handleImportJSON = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        return;
      }
      
      const file = result.assets[0];
      await loadJSONFromFile(file.uri);
      
      if (Platform.OS === 'web') {
        window.alert('✅ JSON caricato da file e salvato nel database!');
      } else {
        Alert.alert('✅ Successo', 'JSON caricato da file e salvato nel database!');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      if (Platform.OS === 'web') {
        window.alert(`❌ Errore: ${errorMessage}`);
      } else {
        Alert.alert('❌ Errore', errorMessage);
      }
    }
  };
  
  const handleDownloadJSON = () => {
    if (!jsonData) return;
    
    if (Platform.OS === 'web') {
      // Sul web, crea un blob e scarica
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `parsed-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Su mobile, mostra un alert con le istruzioni
      Alert.alert(
        'Download JSON',
        'Il JSON è disponibile nella console. Usa i log per vedere i dati.'
      );
    }
  };
  
  return (
    <AppLayout>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled={true}
      >
        <View style={styles.section}>
          <CostSettingsForm />
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestione File</Text>
          <ExcelFileProcessor />
          <UploadedFilesList />
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Database JSON</Text>
          <Text style={styles.sectionDescription}>
            Il file JSON viene salvato automaticamente quando carichi un file Excel.
            {Platform.OS === 'web' && '\n\n💡 Su web: il file viene scaricato automaticamente nella cartella Download. Puoi spostarlo in database_json/ per tenerlo nel progetto.'}
            {Platform.OS !== 'web' && '\n\n💡 Su mobile: il file è salvato nella directory documenti dell\'app.'}
          </Text>
          <TouchableOpacity 
            style={styles.debugButton} 
            onPress={handleShowDebug}
            activeOpacity={0.7}
          >
            <FileText size={18} color={colors.primary} />
            <Text style={styles.debugButtonText}>Visualizza/Modifica JSON</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.debugButton, { marginTop: 8 }]} 
            onPress={handleReloadFromJSON}
            activeOpacity={0.7}
          >
            <Settings size={18} color={colors.primary} />
            <Text style={styles.debugButtonText}>Ricarica da JSON</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Zona Pericolosa</Text>
          <TouchableOpacity 
            style={styles.dangerButton} 
            onPress={() => {
              console.log('TouchableOpacity premuto - chiamata handleClearData');
              handleClearData();
            }}
            activeOpacity={0.7}
          >
            <Trash2 size={18} color={colors.card} />
            <Text style={styles.dangerButtonText}>Cancella Tutti i Dati</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Modal di conferma personalizzato */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelClear}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cancella Tutti i Dati</Text>
              <TouchableOpacity onPress={handleCancelClear} style={styles.modalCloseButton}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.modalMessage}>
                Sei sicuro di voler cancellare tutti i dati del magazzino?
              </Text>
              <Text style={styles.modalWarning}>
                Questa azione non può essere annullata.
              </Text>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={handleCancelClear}
              >
                <Text style={styles.modalButtonCancelText}>Annulla</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleConfirmClear}
                disabled={isClearing}
              >
                <Text style={styles.modalButtonConfirmText}>
                  {isClearing ? 'Cancellazione...' : 'Cancella Dati'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Modal Debug JSON */}
      <Modal
        visible={showDebugModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDebugModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.jsonModalContent]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <FileText size={24} color={colors.primary} />
                <Text style={styles.modalTitle}>Database JSON</Text>
              </View>
              <View style={styles.modalHeaderRight}>
                {jsonData && (
                  <>
                    <TouchableOpacity 
                      onPress={handleDownloadJSON} 
                      style={styles.downloadButton}
                    >
                      <Download size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={handleSaveJSON} 
                      style={[styles.downloadButton, { backgroundColor: colors.primary, borderRadius: 4, padding: 4 }]}
                    >
                      <Text style={{ color: colors.card, fontSize: 12, fontWeight: '600' }}>Salva</Text>
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity 
                  onPress={() => setShowDebugModal(false)} 
                  style={styles.modalCloseButton}
                >
                  <X size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            
            <ScrollView style={styles.jsonContainer} nestedScrollEnabled={true}>
              {loadingJSON ? (
                <Text style={styles.jsonLoadingText}>Caricamento JSON...</Text>
              ) : jsonData ? (
                <Text style={styles.jsonText}>{jsonData}</Text>
              ) : (
                <View style={styles.jsonEmptyContainer}>
                  <Text style={styles.jsonEmptyText}>Nessun JSON disponibile</Text>
                  <Text style={styles.jsonEmptySubtext}>
                    Carica un file Excel per generare il JSON di debug
                  </Text>
                </View>
              )}
            </ScrollView>
            
            {jsonData && (
              <View style={styles.jsonStats}>
                <Text style={styles.jsonStatsText}>
                  Dimensione: {(jsonData.length / 1024).toFixed(2)} KB
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textSecondary || colors.text,
    marginBottom: 16,
    lineHeight: 20,
    opacity: 0.8,
  },
  dangerZone: {
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  dangerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.notification,
    marginBottom: 16,
  },
  dangerButton: {
    backgroundColor: colors.notification,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 48,
    zIndex: 10,
  },
  dangerButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  debugButton: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  debugButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 12,
    width: "100%",
    maxWidth: 400,
    ...createShadowStyle("#000", { width: 0, height: 4 }, 0.3, 12, 4),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  modalHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  downloadButton: {
    padding: 4,
  },
  jsonModalContent: {
    maxWidth: "90%",
    maxHeight: "90%",
  },
  jsonContainer: {
    flex: 1,
    padding: 16,
    maxHeight: 500,
  },
  jsonText: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    fontSize: 12,
    color: colors.text,
    lineHeight: 18,
  },
  jsonLoadingText: {
    fontSize: 14,
    color: colors.text,
    textAlign: "center",
    padding: 20,
  },
  jsonEmptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  jsonEmptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  jsonEmptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  jsonStats: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  jsonStatsText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  modalMessage: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  modalWarning: {
    fontSize: 14,
    color: colors.notification,
    fontWeight: "500",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: colors.lightGray,
  },
  modalButtonConfirm: {
    backgroundColor: colors.notification,
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.card,
  },
});
