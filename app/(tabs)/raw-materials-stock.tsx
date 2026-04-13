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
import { Download, FileBarChart, RefreshCw } from "lucide-react-native";
import { buildRawMaterialsReportFromCsv, RawMaterialRow } from "@/utils/rawMaterialsReport";
import { buildReportPdfHtml } from "@/utils/rawMaterialsReportPdf";
import { downloadRawMaterialsReportPdfWeb } from "@/utils/rawMaterialsReportPdfDownload";

const productsData = require("@/prodotti.json") as { prodotti: string[] };

export default function RawMaterialsStockScreen() {
  const { uploadedFiles } = useWarehouseStore();
  const [exporting, setExporting] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportRows, setReportRows] = useState<RawMaterialRow[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);

  const latestCsvFile = useMemo(() => {
    const csvFiles = uploadedFiles.filter((f) => f.name.toLowerCase().endsWith(".csv"));
    if (csvFiles.length === 0) return null;
    return [...csvFiles].sort(
      (a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    )[0];
  }, [uploadedFiles]);

  const loadReport = async () => {
    const products = Array.isArray(productsData.prodotti) ? productsData.prodotti : [];
    if (!latestCsvFile?.uri) {
      setReportRows(products.map((nome) => ({ nome_materia_prima: nome, giacenza_bancali: 0 })));
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

      const rows = buildRawMaterialsReportFromCsv(csvText, products);
      setReportRows(rows);
    } catch (error: any) {
      setReportRows(products.map((nome) => ({ nome_materia_prima: nome, giacenza_bancali: 0 })));
      setReportError(`Errore lettura file CSV: ${error?.message || "errore sconosciuto"}`);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [latestCsvFile?.id]);

  const handleDownloadPdf = async () => {
    try {
      setExporting(true);
      const catalog = Array.isArray(productsData.prodotti) ? productsData.prodotti : [];

      if (Platform.OS === "web") {
        /* expo-print su web chiama solo window.print() e ignora l'HTML: PDF dai dati con jsPDF */
        downloadRawMaterialsReportPdfWeb(reportRows, catalog);
        return;
      }

      const html = buildReportPdfHtml(reportRows, catalog);
      const file = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/pdf",
          dialogTitle: "Scarica report giacenza materie prime",
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
            <FileBarChart size={20} color={colors.primary} />
            <Text style={styles.title}>Giacenza Materie Prime</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.refreshButton} onPress={loadReport} disabled={loadingReport}>
              {loadingReport ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <RefreshCw size={16} color={colors.primary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadPdf} disabled={exporting || loadingReport}>
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

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.nameColumn]}>Materia Prima</Text>
            <Text style={[styles.headerText, styles.qtyColumn]}>Quantità</Text>
          </View>
          {reportRows.map((row) => (
            <View key={row.nome_materia_prima} style={styles.row}>
              <Text style={[styles.rowName, styles.nameColumn]}>{row.nome_materia_prima}</Text>
              <Text style={[styles.rowQty, styles.qtyColumn, row.giacenza_bancali === 0 && styles.rowQtyZero]}>
                {row.giacenza_bancali}
              </Text>
            </View>
          ))}
        </ScrollView>
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
    backgroundColor: colors.primary,
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
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
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
    color: colors.primary,
  },
  rowQtyZero: {
    color: colors.darkGray,
  },
});
