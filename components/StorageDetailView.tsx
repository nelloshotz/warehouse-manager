import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import { colors } from "@/constants/colors";
import { X, Clock } from "lucide-react-native";
import { useWarehouseStore } from "@/store/warehouseStore";
import { DocumentMonthStorage, stockAtMonthEnd } from "@/utils/storageCalculation";
import { formatCurrency, formatMonth } from "@/utils/calculations";
import { createShadowStyle } from "@/utils/shadowStyles";
import StorageMonthTable, { splitByRegime } from "@/components/StorageMonthTable";

interface StorageDetailViewProps {
  month: string;
  visible: boolean;
  onClose: () => void;
}

/**
 * Dettaglio stoccaggio di un mese: tutti i documenti in magazzino nel mese,
 * ciascuno con i propri periodi di stoccaggio, e il totale del mese.
 */
export default function StorageDetailView({
  month,
  visible,
  onClose,
}: StorageDetailViewProps) {
  const { getStorageMonthDetail } = useWarehouseStore();
  const [documenti, setDocumenti] = useState<DocumentMonthStorage[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDocumenti(null);
    getStorageMonthDetail(month).then((result) => {
      if (!cancelled) setDocumenti(result);
    });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const perRegime = splitByRegime(documenti || []);
  const stock = stockAtMonthEnd(documenti || [], month);
  const now = new Date();
  const isCurrentMonth = month === `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const stockLabel = isCurrentMonth ? "ad oggi" : "a fine mese";
  const totaleMese = perRegime.ambient + perRegime.congelato;

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
                Dettaglio stoccaggio - {formatMonth(month)}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {documenti === null ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : documenti.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nessun dato di stoccaggio per questo mese</Text>
            </View>
          ) : (
            <FlatList
              style={styles.list}
              contentContainerStyle={styles.listContent}
              data={documenti}
              keyExtractor={(item) => item.numero_documento}
              ListHeaderComponent={
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Documenti</Text>
                    <Text style={styles.statValue}>{documenti.length}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Ambient {stockLabel}</Text>
                    <Text style={styles.statValue}>{stock.ambient.equivalenti} equiv.</Text>
                    <Text style={styles.statSub}>{stock.ambient.bancali} bancali</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Congelato {stockLabel}</Text>
                    <Text style={styles.statValue}>{stock.congelato.equivalenti} equiv.</Text>
                    <Text style={styles.statSub}>{stock.congelato.bancali} bancali</Text>
                  </View>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.docCard}>
                  <View style={styles.docHeader}>
                    <Text style={styles.docTitle}>{item.numero_documento}</Text>
                    <Text style={styles.docTitle}>{formatCurrency(item.costo)}</Text>
                  </View>
                  <StorageMonthTable entry={item} />
                </View>
              )}
              ListFooterComponent={
                <View style={styles.footer}>
                  <Text style={styles.totalLabel}>Totale documenti</Text>
                  <Text style={styles.totalValue}>{formatCurrency(totaleMese)}</Text>
                </View>
              }
            />
          )}
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
    width: "95%",
    maxWidth: 760,
    height: "85%",
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
    flex: 1,
  },
  headerIcon: {
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    textTransform: "capitalize",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.lightGray,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
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
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    padding: 10,
  },
  statLabel: {
    fontSize: 12,
    color: colors.darkGray,
  },
  statSub: {
    fontSize: 12,
    color: colors.darkGray,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  docCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  docHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  docTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    textTransform: "capitalize",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
  },
});
