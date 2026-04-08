import React, { useMemo, useState } from "react";
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
import AppLayout from "@/components/AppLayout";
import { colors } from "@/constants/colors";
import { useWarehouseStore } from "@/store/warehouseStore";
import { Download, FileBarChart } from "lucide-react-native";
import { buildRawMaterialsReport } from "@/utils/rawMaterialsReport";

const productsData = require("@/prodotti.json") as { prodotti: string[] };

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildPaginatedPdfHtml(
  rows: Array<{ nome_materia_prima: string; giacenza_bancali: number }>
): string {
  const rowsPerPage = 35;
  const pages: string[] = [];

  for (let i = 0; i < rows.length; i += rowsPerPage) {
    const chunk = rows.slice(i, i + rowsPerPage);
    const tableRows = chunk
      .map(
        (row) => `
        <tr>
          <td>${escapeHtml(row.nome_materia_prima)}</td>
          <td style="text-align:right;">${row.giacenza_bancali}</td>
        </tr>`
      )
      .join("");

    pages.push(`
      <div class="page">
        <h1>Report Giacenza Materie Prime</h1>
        <p class="subtitle">Generato il ${new Date().toLocaleDateString("it-IT")}</p>
        <table>
          <thead>
            <tr>
              <th>Materia Prima</th>
              <th>Giacenza Bancali</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `);
  }

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #111827; }
          .page { page-break-after: always; padding: 8px 10px; }
          .page:last-child { page-break-after: auto; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          .subtitle { font-size: 12px; color: #6B7280; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #D1D5DB; padding: 6px 8px; font-size: 12px; }
          th { background: #F3F4F6; text-align: left; }
        </style>
      </head>
      <body>
        ${pages.join("\n")}
      </body>
    </html>
  `;
}

export default function RawMaterialsStockScreen() {
  const { documentRows } = useWarehouseStore();
  const [exporting, setExporting] = useState(false);

  const reportRows = useMemo(() => {
    const products = Array.isArray(productsData.prodotti) ? productsData.prodotti : [];
    return buildRawMaterialsReport(documentRows, products);
  }, [documentRows]);

  const handleDownloadPdf = async () => {
    try {
      setExporting(true);
      const html = buildPaginatedPdfHtml(reportRows);
      const file = await Print.printToFileAsync({ html, base64: Platform.OS === "web" });

      if (Platform.OS === "web") {
        const base64 = file.base64;
        if (!base64) throw new Error("Base64 PDF non disponibile");
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${base64}`;
        link.download = `report-giacenza-materie-prime-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (await Sharing.isAvailableAsync()) {
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
          <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadPdf} disabled={exporting}>
            {exporting ? (
              <ActivityIndicator size="small" color={colors.card} />
            ) : (
              <Download size={16} color={colors.card} />
            )}
            <Text style={styles.downloadButtonText}>{exporting ? "Creo PDF..." : "Scarica PDF"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {reportRows.map((row) => (
            <View key={row.nome_materia_prima} style={styles.row}>
              <Text style={styles.rowName}>{row.nome_materia_prima}</Text>
              <Text style={[styles.rowQty, row.giacenza_bancali === 0 && styles.rowQtyZero]}>
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
  downloadButtonText: {
    color: colors.card,
    fontSize: 13,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  rowName: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    marginRight: 12,
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
