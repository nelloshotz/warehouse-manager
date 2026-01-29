import React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from "react-native";
import { colors } from "@/constants/colors";
import { X, Clock, Calendar } from "lucide-react-native";
import { useWarehouseStore } from "@/store/warehouseStore";
import { formatCurrency, formatMonth } from "@/utils/calculations";
import { createShadowStyle } from "@/utils/shadowStyles";

interface StorageDetailViewProps {
  month: string;
  visible: boolean;
  onClose: () => void;
}

export default function StorageDetailView({
  month,
  visible,
  onClose,
}: StorageDetailViewProps) {
  const { documentRows } = useWarehouseStore();
  
  // Analizza la chiave del mese per ottenere anno e mese
  const [year, monthNum] = month.split('-').map(Number);
  
  // Filtra le righe del documento che erano attive in questo mese
  const rowsInMonth = documentRows.filter(row => {
    const inDate = new Date(row.data_ingresso);
    const inYear = inDate.getFullYear();
    const inMonth = inDate.getMonth() + 1;
    
    // Controlla se la riga è stata inserita in questo mese o prima
    return (inYear < year || (inYear === year && inMonth <= monthNum));
  });
  
  // Formatta la data per la visualizzazione
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.headerContent}>
              <Clock size={20} color={colors.secondary} style={styles.headerIcon} />
              <Text style={styles.modalTitle}>
                Dettagli Stoccaggio - {formatMonth(month)}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            {rowsInMonth.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Nessun dato di stoccaggio per questo mese</Text>
              </View>
            ) : (
              rowsInMonth.map((row, index) => {
                const inDate = new Date(row.data_ingresso);
                const is100x120 = row.tipologia_bancali_ingresso.toUpperCase() === '100X120';
                const palletType = is100x120 ? "100x120" : "80x120";
                
                // Controlla se ci sono state uscite in questo mese
                const exitsInMonth = Object.values(row.uscite).filter(exit => {
                  if (!exit.data) return false;
                  const exitDate = new Date(exit.data);
                  return exitDate.getFullYear() === year && exitDate.getMonth() + 1 === monthNum;
                });
                
                return (
                  <View key={index} style={styles.rowCard}>
                    <View style={styles.rowHeader}>
                      <View style={styles.dateContainer}>
                        <Calendar size={14} color={colors.darkGray} style={styles.dateIcon} />
                        <Text style={styles.dateText}>
                          Ingresso: {formatDate(row.data_ingresso)}
                        </Text>
                      </View>
                      <Text style={styles.palletType}>
                        {palletType} ({row.numero_bancali_ingresso} bancali)
                      </Text>
                    </View>
                    
                    {row.note && (
                      <Text style={styles.noteText}>Nota: {row.note}</Text>
                    )}
                    
                    {exitsInMonth.length > 0 && (
                      <View style={styles.exitsContainer}>
                        <Text style={styles.exitsTitle}>Uscite in questo mese:</Text>
                        {exitsInMonth.map((exit, exitIndex) => (
                          <View key={exitIndex} style={styles.exitItem}>
                            <Text style={styles.exitDate}>
                              {formatDate(exit.data!)}
                            </Text>
                            <Text style={styles.exitDetails}>
                              {exit.bancali} bancali ({exit.giorni} giorni)
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 12,
    width: "90%",
    maxWidth: 500,
    maxHeight: "80%",
    ...createShadowStyle("#000", { width: 0, height: 2 }, 0.25, 3.84, 5),
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.lightGray,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    padding: 16,
    maxHeight: 500,
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.darkGray,
    fontSize: 16,
  },
  rowCard: {
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateIcon: {
    marginRight: 4,
  },
  dateText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  palletType: {
    fontSize: 14,
    color: colors.darkGray,
  },
  noteText: {
    fontSize: 14,
    color: colors.text,
    fontStyle: "italic",
    marginBottom: 8,
  },
  exitsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exitsTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
    marginBottom: 8,
  },
  exitItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  exitDate: {
    fontSize: 13,
    color: colors.text,
  },
  exitDetails: {
    fontSize: 13,
    color: colors.darkGray,
  },
});