import React from "react";
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from "react-native";
import { colors } from "@/constants/colors";
import { X, FileText } from "lucide-react-native";
import { formatCurrency, formatDate } from "@/utils/calculations";
import { DocumentRow, Document } from "@/types/warehouse";
import { createShadowStyle } from "@/utils/shadowStyles";

interface MonthDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  monthKey: string;
  monthName: string;
  type: 'entry' | 'exit';
  documentRows: DocumentRow[];
  documents: Document[];
}

export default function MonthDetailsModal({
  visible,
  onClose,
  monthKey,
  monthName,
  type,
  documentRows,
  documents,
}: MonthDetailsModalProps) {
  // Crea una mappa per trovare rapidamente i documenti
  const documentsMap = new Map<number, Document>();
  documents.forEach(doc => {
    documentsMap.set(doc.id, doc);
  });

  // Per gli ingressi, mostra le righe ordinate per data
  const entryRows = type === 'entry' 
    ? [...documentRows].sort((a, b) => 
        new Date(a.data_ingresso).getTime() - new Date(b.data_ingresso).getTime()
      )
    : [];

  // Per le uscite, mostra le uscite ordinate per data
  const exitRows = type === 'exit'
    ? documentRows
        .filter(row => {
          return Object.values(row.uscite).some(uscita => {
            if (!uscita.data) return false;
            const exitDate = new Date(uscita.data);
            const [year, month] = monthKey.split('-').map(Number);
            return exitDate.getFullYear() === year && exitDate.getMonth() + 1 === month;
          });
        })
        .flatMap(row => {
          const doc = documentsMap.get(row.documento_id);
          return Object.entries(row.uscite)
            .filter(([_, uscita]) => {
              if (!uscita.data) return false;
              const exitDate = new Date(uscita.data);
              const [year, month] = monthKey.split('-').map(Number);
              return exitDate.getFullYear() === year && exitDate.getMonth() + 1 === month;
            })
            .map(([key, uscita]) => ({
              row,
              doc,
              uscitaKey: key,
              uscita,
            }));
        })
        .sort((a, b) => {
          const dateA = a.uscita.data ? new Date(a.uscita.data).getTime() : 0;
          const dateB = b.uscita.data ? new Date(b.uscita.data).getTime() : 0;
          return dateA - dateB;
        })
    : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleContainer}>
              <FileText size={20} color={colors.primary} />
              <Text style={styles.modalTitle}>
                {type === 'entry' ? 'Dettagli Ingressi' : 'Dettagli Uscite'} - {monthName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
            {type === 'entry' ? (
              <>
                {entryRows.length === 0 ? (
                  <Text style={styles.emptyText}>Nessun ingresso per questo mese</Text>
                ) : (
                  entryRows.map((row, index) => {
                    const doc = documentsMap.get(row.documento_id);
                    const is100x120 = row.tipologia_bancali_ingresso.toUpperCase() === '100X120';
                    const isCongelato = row.note.toUpperCase().includes('CONGELATO');
                    
                    return (
                      <View key={row.id} style={styles.detailCard}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Numero Documento:</Text>
                          <Text style={styles.detailValue}>{doc?.numero_documento || 'N/A'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Data Ingresso:</Text>
                          <Text style={styles.detailValue}>{formatDate(row.data_ingresso)}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Bancali:</Text>
                          <Text style={styles.detailValue}>
                            {row.numero_bancali_ingresso} {is100x120 ? '100x120' : '80x120'}
                            {isCongelato && ' (Congelato)'}
                          </Text>
                        </View>
                        {row.note && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Note:</Text>
                            <Text style={styles.detailValue}>{row.note}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </>
            ) : (
              <>
                {exitRows.length === 0 ? (
                  <Text style={styles.emptyText}>Nessuna uscita per questo mese</Text>
                ) : (
                  exitRows.map((item, index) => {
                    const { row, doc, uscita } = item;
                    const is100x120 = row.tipologia_bancali_ingresso.toUpperCase() === '100X120';
                    const isCongelato = row.note.toUpperCase().includes('CONGELATO');
                    
                    return (
                      <View key={`${row.id}-${item.uscitaKey}`} style={styles.detailCard}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Numero Documento:</Text>
                          <Text style={styles.detailValue}>{doc?.numero_documento || 'N/A'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Data Ingresso:</Text>
                          <Text style={styles.detailValue}>{formatDate(row.data_ingresso)}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Data Uscita:</Text>
                          <Text style={styles.detailValue}>{uscita.data ? formatDate(uscita.data) : 'N/A'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Bancali Usciti:</Text>
                          <Text style={styles.detailValue}>
                            {uscita.bancali} {is100x120 ? '100x120' : '80x120'}
                            {isCongelato && ' (Congelato)'}
                          </Text>
                        </View>
                        {uscita.giorni !== null && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Giorni in Stoccaggio:</Text>
                            <Text style={styles.detailValue}>{uscita.giorni} giorni</Text>
                          </View>
                        )}
                        {row.note && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Note:</Text>
                            <Text style={styles.detailValue}>{row.note}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const shadowStyle = createShadowStyle("#000", { width: 0, height: 4 }, 0.2, 8, 4);

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    ...shadowStyle,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  detailCard: {
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    padding: 12,
    margin: 16,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.darkGray,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
    textAlign: "right",
  },
  emptyText: {
    textAlign: "center",
    color: colors.darkGray,
    fontSize: 16,
    padding: 24,
  },
});




