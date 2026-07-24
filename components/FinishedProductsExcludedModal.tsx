import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as FileSystem from "expo-file-system";
import { colors } from "@/constants/colors";
import { X, Search, Check } from "lucide-react-native";
import { useFinishedProductsExcludedStore } from "@/store/finishedProductsExcludedStore";
import { useRawMaterialsProductsStore } from "@/store/rawMaterialsProductsStore";
import { useWarehouseStore } from "@/store/warehouseStore";
import { sanitizeProductName, normalizeProductName } from "@/utils/finishedProductsReport";
import { RAW_MATERIALS_REPORT_CSV_COLUMNS } from "@/constants/settings";

interface FinishedProductsExcludedModalProps {
  visible: boolean;
  onClose: () => void;
}

function parseCsvLine(line: string, delimiter = ";"): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out;
}

export default function FinishedProductsExcludedModal({
  visible,
  onClose,
}: FinishedProductsExcludedModalProps) {
  const { uploadedFiles } = useWarehouseStore();
  const rawMaterialsProducts = useRawMaterialsProductsStore((state) => state.products);
  const excludedProducts = useFinishedProductsExcludedStore((state) => state.excludedProducts);
  const addProduct = useFinishedProductsExcludedStore((state) => state.addProduct);
  const removeProduct = useFinishedProductsExcludedStore((state) => state.removeProduct);

  const [csvProducts, setCsvProducts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedExcluded, setSelectedExcluded] = useState<Set<string>>(new Set());

  const latestCsvFile = useMemo(() => {
    const csvFiles = uploadedFiles.filter((f) => f.name.toLowerCase().endsWith(".csv"));
    if (csvFiles.length === 0) return null;
    return [...csvFiles].sort(
      (a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    )[0];
  }, [uploadedFiles]);

  useEffect(() => {
    if (visible && latestCsvFile) {
      loadProducts();
    }
  }, [visible, latestCsvFile?.id]);

  const loadProducts = async () => {
    if (!latestCsvFile?.uri) return;

    try {
      setLoading(true);
      let csvText = "";
      if (Platform.OS === "web") {
        const response = await fetch(latestCsvFile.uri);
        csvText = await response.text();
      } else {
        csvText = await FileSystem.readAsStringAsync(latestCsvFile.uri);
      }

      const lines = csvText.split(/\r?\n/).filter((line) => line.length > 0);
      if (lines.length < 2) {
        setCsvProducts([]);
        return;
      }

      const rawMaterialsSet = new Set<string>();
      rawMaterialsProducts.forEach((name) => {
        rawMaterialsSet.add(normalizeProductName(name));
      });

      const productsMap = new Map<string, string>();
      const DESCRIZIONE_INDEX = RAW_MATERIALS_REPORT_CSV_COLUMNS.descrizione;

      for (let i = 1; i < lines.length; i += 1) {
        const row = parseCsvLine(lines[i], ";");
        const descrizioneOriginal = sanitizeProductName(row[DESCRIZIONE_INDEX] || "");
        const descrizione = normalizeProductName(descrizioneOriginal);
        
        if (!descrizione) continue;
        if (rawMaterialsSet.has(descrizione)) continue;
        
        productsMap.set(descrizione, descrizioneOriginal);
      }

      const uniqueProducts = Array.from(productsMap.values()).sort((a, b) =>
        a.localeCompare(b, "it", { sensitivity: "base" })
      );

      setCsvProducts(uniqueProducts);
    } catch (error) {
      console.error("Errore caricamento prodotti:", error);
      setCsvProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredCsvProducts = useMemo(() => {
    if (!searchText) return csvProducts;
    const search = searchText.toLowerCase();
    return csvProducts.filter((p) => p.toLowerCase().includes(search));
  }, [csvProducts, searchText]);

  const availableProducts = useMemo(() => {
    const excludedSet = new Set(excludedProducts.map((p) => normalizeProductName(p)));
    return filteredCsvProducts.filter((p) => !excludedSet.has(normalizeProductName(p)));
  }, [filteredCsvProducts, excludedProducts]);

  const handleToggleProduct = (product: string) => {
    const newSet = new Set(selectedProducts);
    if (newSet.has(product)) {
      newSet.delete(product);
    } else {
      newSet.add(product);
    }
    setSelectedProducts(newSet);
  };

  const handleToggleExcluded = (product: string) => {
    const newSet = new Set(selectedExcluded);
    if (newSet.has(product)) {
      newSet.delete(product);
    } else {
      newSet.add(product);
    }
    setSelectedExcluded(newSet);
  };

  const handleExcludeSelected = () => {
    selectedProducts.forEach((product) => {
      addProduct(product);
    });
    setSelectedProducts(new Set());
  };

  const handleReEnableSelected = () => {
    selectedExcluded.forEach((product) => {
      removeProduct(product);
    });
    setSelectedExcluded(new Set());
  };

  const handleClose = () => {
    setSearchText("");
    setSelectedProducts(new Set());
    setSelectedExcluded(new Set());
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>Gestione Prodotti Esclusi</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.secondary} />
              <Text style={styles.loadingText}>Caricamento prodotti...</Text>
            </View>
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Prodotti Disponibili</Text>
                <View style={styles.searchContainer}>
                  <Search size={16} color={colors.darkGray} />
                  <TextInput
                    style={styles.searchInput}
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Cerca prodotto..."
                    placeholderTextColor={colors.darkGray}
                  />
                </View>
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                  {availableProducts.length === 0 ? (
                    <Text style={styles.emptyText}>Nessun prodotto disponibile</Text>
                  ) : (
                    availableProducts.map((product) => (
                      <TouchableOpacity
                        key={product}
                        style={[
                          styles.productRow,
                          selectedProducts.has(product) && styles.productRowSelected,
                        ]}
                        onPress={() => handleToggleProduct(product)}
                      >
                        <View style={styles.checkbox}>
                          {selectedProducts.has(product) && (
                            <Check size={16} color={colors.secondary} />
                          )}
                        </View>
                        <Text style={styles.productName}>{product}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
                {selectedProducts.size > 0 && (
                  <TouchableOpacity style={styles.actionButton} onPress={handleExcludeSelected}>
                    <Text style={styles.actionButtonText}>
                      Escludi {selectedProducts.size} selezionat{selectedProducts.size > 1 ? "i" : "o"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={[styles.section, styles.sectionExcluded]}>
                <Text style={styles.sectionTitle}>Prodotti Esclusi ({excludedProducts.length})</Text>
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                  {excludedProducts.length === 0 ? (
                    <Text style={styles.emptyText}>Nessun prodotto escluso</Text>
                  ) : (
                    excludedProducts.map((product) => (
                      <TouchableOpacity
                        key={product}
                        style={[
                          styles.productRow,
                          styles.productRowExcluded,
                          selectedExcluded.has(product) && styles.productRowSelected,
                        ]}
                        onPress={() => handleToggleExcluded(product)}
                      >
                        <View style={styles.checkbox}>
                          {selectedExcluded.has(product) && (
                            <Check size={16} color={colors.secondary} />
                          )}
                        </View>
                        <Text style={styles.productName}>{product}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
                {selectedExcluded.size > 0 && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonSuccess]}
                    onPress={handleReEnableSelected}
                  >
                    <Text style={styles.actionButtonText}>
                      Riabilita {selectedExcluded.size} selezionat{selectedExcluded.size > 1 ? "i" : "o"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  panel: {
    backgroundColor: colors.card,
    borderRadius: 12,
    maxHeight: "90%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    padding: 48,
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: colors.darkGray,
  },
  section: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
  },
  sectionExcluded: {
    borderBottomWidth: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  list: {
    maxHeight: 220,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  emptyText: {
    textAlign: "center",
    color: colors.darkGray,
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: 24,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  productRowSelected: {
    borderColor: colors.secondary,
    backgroundColor: `${colors.secondary}15`,
  },
  productRowExcluded: {
    backgroundColor: colors.lightGray,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  productName: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  actionButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
  },
  actionButtonSuccess: {
    backgroundColor: colors.success,
  },
  actionButtonText: {
    color: colors.card,
    fontWeight: "600",
    fontSize: 14,
  },
});
