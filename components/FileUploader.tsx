import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useWarehouseStore } from "@/store/warehouseStore";
import { colors } from "@/constants/colors";
import { FileText, Upload, AlertCircle } from "lucide-react-native";
import { createShadowStyle } from "@/utils/shadowStyles";

export default function FileUploader() {
  const { addUploadedFile, isLoading, setLoading, setError } = useWarehouseStore();
  const [uploadProgress, setUploadProgress] = useState(0);

  const pickDocument = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        setLoading(false);
        return;
      }
      
      const file = result.assets[0];
      
      // Simula l'elaborazione del file
      simulateProcessing();
      
      // In un'app reale, elaboreresti il file Excel qui
      // Per ora, lo aggiungiamo semplicemente alla lista dei file caricati
      addUploadedFile({
        id: Date.now().toString(),
        name: file.name,
        uri: file.uri,
        size: file.size || 0,
        uploadDate: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error("Errore durante la selezione del documento:", error);
      setError("Impossibile caricare il file. Riprova.");
      Alert.alert("Errore di caricamento", "Impossibile caricare il file. Riprova.");
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };
  
  const simulateProcessing = () => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.1;
      setUploadProgress(Math.min(progress, 1));
      if (progress >= 1) {
        clearInterval(interval);
      }
    }, 100);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <FileText color={colors.primary} size={24} />
        <Text style={styles.title}>Carica File Excel</Text>
      </View>
      
      <Text style={styles.description}>
        Carica il tuo file Excel del magazzino per elaborare ingressi, uscite e dati di stoccaggio.
      </Text>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            Elaborazione file... {Math.round(uploadProgress * 100)}%
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.uploadButton} onPress={pickDocument}>
          <Upload color={colors.card} size={20} />
          <Text style={styles.uploadButtonText}>Seleziona File</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.infoContainer}>
        <AlertCircle color={colors.info} size={16} />
        <Text style={styles.infoText}>
          Formati supportati: .xls, .xlsx
        </Text>
      </View>
    </View>
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