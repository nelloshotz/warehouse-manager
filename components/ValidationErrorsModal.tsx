import React from "react";
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { AlertCircle, X } from "lucide-react-native";
import { colors } from "@/constants/colors";

interface ValidationError {
  documento: string;
  tipo: 'date_future' | 'uscite_superiori_ingresso' | 'data_uscita_precedente_ingresso' | 'bancali_senza_data' | 'data_senza_bancali';
  dettagli: string;
  riga?: number;
}

interface ValidationErrorsModalProps {
  visible: boolean;
  errors: ValidationError[];
  onClose: () => void;
}

const tipoLabels: Record<ValidationError['tipo'], string> = {
  date_future: '📅 Data Uscita Futura',
  uscite_superiori_ingresso: '⚠️ Uscite Superiori all\'Ingresso',
  data_uscita_precedente_ingresso: '📆 Data Uscita Precedente all\'Ingresso',
  bancali_senza_data: '❌ Bancali Senza Data',
  data_senza_bancali: '❌ Data Senza Bancali'
};

export default function ValidationErrorsModal({ visible, errors, onClose }: ValidationErrorsModalProps) {
  // Raggruppa errori per documento
  const errorsByDocument = new Map<string, ValidationError[]>();
  errors.forEach(error => {
    if (!errorsByDocument.has(error.documento)) {
      errorsByDocument.set(error.documento, []);
    }
    errorsByDocument.get(error.documento)!.push(error);
  });

  // Raggruppa errori per tipo
  const errorsByType = new Map<ValidationError['tipo'], ValidationError[]>();
  errors.forEach(error => {
    if (!errorsByType.has(error.tipo)) {
      errorsByType.set(error.tipo, []);
    }
    errorsByType.get(error.tipo)!.push(error);
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <AlertCircle size={24} color={colors.warning} />
              <Text style={styles.title}>Errori di Validazione Rilevati</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              Trovati <Text style={styles.summaryBold}>{errors.length}</Text> errori in <Text style={styles.summaryBold}>{errorsByDocument.size}</Text> documento/i
            </Text>
            <Text style={styles.summarySubtext}>
              Correggi il file CSV e ricaricalo per calcoli corretti
            </Text>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {Array.from(errorsByType.entries()).map(([tipo, tipoErrors]) => (
              <View key={tipo} style={styles.errorSection}>
                <Text style={styles.errorTypeTitle}>
                  {tipoLabels[tipo]} ({tipoErrors.length})
                </Text>
                {tipoErrors.map((error, idx) => (
                  <View key={idx} style={styles.errorItem}>
                    <Text style={styles.errorDocument}>Documento: {error.documento}</Text>
                    <Text style={styles.errorDetails}>{error.dettagli}</Text>
                    {error.riga && (
                      <Text style={styles.errorRiga}>Riga CSV: {error.riga}</Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeButtonLarge} onPress={onClose}>
              <Text style={styles.closeButtonText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  summary: {
    padding: 20,
    backgroundColor: colors.warning + '20',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  summaryBold: {
    fontWeight: 'bold',
    color: colors.warning,
  },
  summarySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  errorSection: {
    marginBottom: 24,
  },
  errorTypeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  errorItem: {
    backgroundColor: colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  errorDocument: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  errorDetails: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  errorRiga: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closeButtonLarge: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});


