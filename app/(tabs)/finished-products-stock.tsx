import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import AppLayout from "@/components/AppLayout";
import { colors } from "@/constants/colors";
import { useWarehouseStore } from "@/store/warehouseStore";
import { Download, Package, RefreshCw, Settings } from "lucide-react-native";
import { buildFinishedProductsReportFromCsv, FinishedProductRow } from "@/utils/finishedProductsReport";
import { buildReportPdfHtml } from "@/utils/finishedProductsReportPdf";
import { downloadFinishedProductsReportPdfWeb } from "@/utils/finishedProductsReportPdfDownload.web";
import { useRawMaterialsProductsStore } from "@/store/rawMaterialsProductsStore";
import { useFinishedProductsExcludedStore } from "@/store/finishedProductsExcludedStore";
import FinishedProductsExcludedModal from "@/components/FinishedProductsExcludedModal";

export default function FinishedProductsStockScreen() {
  const { uploadedFiles } = useWarehouseStore();
  const rawMaterialsProducts = useRawMaterialsProductsStore((state) => state.products);
  const excludedProducts = useFinishedProductsExcludedStore((state) => state.excludedProducts);
  const [exporting, setExporting] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportRows, setReportRows] = useState<FinishedProductRow[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);
  const [excludedModalVisible, setExcludedModalVisible] = useState(false);

  const latestCsvFile = useMemo(() => {
    const csvFiles = uploadedFiles.filter((f) => f.name.toLowerCase().endsWith(".csv"));
    if (csvFiles.length === 0) return null;
    return [...csvFiles].sort(
      (a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    )[0];
  }, [uploadedFiles]);

  const loadReport = async () => {
    const rawMaterials = Array.isArray(rawMaterialsProducts) ? rawMaterialsProducts : [];
    const excluded = Array.isArray(excludedProducts) ? excludedProducts : [];
    if (!latestCsvFile?.uri) {
      setReportRows([]);
      setReportError("Nessun CSV caricato. Carica prima un file CSV dalla dashboard.");
      return;
    }

    try {
      setLoadingReport(true);
      setReportError(null);

      let csvText = "";
      if (Platform.OS === "web") {
        const response = await fetch(latestCsvFile.uri);
        csvText = await response.text();
      } else {
        csvText = await FileSystem.readAsStringAsync(latestCsvFile.uri);
      }

      const rows = buildFinishedProductsReportFromCsv(csvText, rawMaterials, excluded);
      setReportRows(rows);
    } catch (error: any) {
      setReportRows([]);
      setReportError(`Errore lettura file CSV: ${error?.message || "errore sconosciuto"}`);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [latestCsvFile?.id, rawMaterialsProducts, excludedProducts]);

  const handleDownloadPdf = async () => {
    try {
      setExporting(true);

      if (Platform.OS === "web") {
        downloadFinishedProductsReportPdfWeb(reportRows);
        return;
      }

      const html = buildReportPdfHtml(reportRows);
      const file = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/pdf",
          dialogTitle: "Scarica report giacenza prodotti finiti",
        });
      } else {
        Alert.alert("PDF creato", `File salvato in: ${file.uri}`);
      }
    } catch (error: any) {
      Alert.alert("Errore", `Impossibile creare il PDF: ${error?.message || "Errore sconosciuto"}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppLayout>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <Package size={20} color={colors.secondary} />
            <Text style={styles.title}>Giacenza Prodotti Finiti</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => setExcludedModalVisible(true)}
              accessibilityLabel="Gestisci prodotti esclusi"
            >
              <Settings size={16} color={colors.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.refreshButton} onPress={loadReport} disabled={loadingReport}>
              {loadingReport ? (
                <ActivityIndicator size="small" color={colors.secondary} />
              ) : (
                <RefreshCw size={16} color={colors.secondary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadPdf} disabled={exporting || loadingReport || reportRows.length === 0}>
              {exporting ? (
                <ActivityIndicator size="small" color={colors.card} />
              ) : (
                <Download size={16} color={colors.card} />
              )}
              <Text style={styles.downloadButtonText}>{exporting ? "Creo PDF..." : "Scarica PDF"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {latestCsvFile && (
          <Text style={styles.sourceText}>Sorgente CSV: {latestCsvFile.name}</Text>
        )}
        {reportError && <Text style={styles.errorText}>{reportError}</Text>}

        {!reportError && reportRows.length === 0 && !loadingReport && (
          <Text style={styles.infoText}>
            Nessun prodotto finito trovato. Verifica che il CSV contenga prodotti diversi dalle materie prime.
          </Text>
        )}

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.nameColumn]}>Prodotto</Text>
            <Text style={[styles.headerText, styles.qtyColumn]}>Quantità</Text>
          </View>
          {reportRows.map((row, index) => (
            <View key={`${row.nome_prodotto}-${index}`} style={styles.row}>
              <Text style={[styles.rowName, styles.nameColumn]}>{row.nome_prodotto}</Text>
              <Text style={[styles.rowQty, styles.qtyColumn, row.giacenza_bancali === 0 && styles.rowQtyZero]}>
                {row.giacenza_bancali}
              </Text>
            </View>
          ))}
          
          {reportRows.length > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, styles.nameColumn]}>TOTALE</Text>
              <Text style={[styles.totalValue, styles.qtyColumn]}>
                {Math.round(reportRows.reduce((sum, row) => sum + row.giacenza_bancali, 0))}
              </Text>
            </View>
          )}
        </ScrollView>

        <FinishedProductsExcludedModal
          visible={excludedModalVisible}
          onClose={() => {
            setExcludedModalVisible(false);
            loadReport();
          }}
        />
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  title: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  downloadButtonText: {
    color: colors.card,
    fontSize: 13,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  sourceText: {
    fontSize: 12,
    color: colors.darkGray,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: colors.warning,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 13,
    color: colors.darkGray,
    marginBottom: 10,
    fontStyle: "italic",
  },
  scrollContent: {
    paddingBottom: 20,
    alignItems: "center",
  },
  tableHeader: {
    width: "100%",
    maxWidth: 780,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  headerText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.darkGray,
    textAlign: "center",
  },
  nameColumn: {
    flex: 1,
    textAlign: "center",
  },
  qtyColumn: {
    width: 120,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    width: "100%",
    maxWidth: 780,
    gap: 12,
  },
  rowName: {
    fontSize: 14,
    color: colors.text,
  },
  rowQty: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.secondary,
  },
  rowQtyZero: {
    color: colors.darkGray,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginTop: 16,
    marginBottom: 8,
    width: "100%",
    maxWidth: 780,
    gap: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.card,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.card,
  },
});
