import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { FinishedProductRow } from "@/utils/finishedProductsReport";
import { formatGiacenzaForPdf } from "@/utils/finishedProductsReportPdf";

/**
 * PDF costruito dai dati (jsPDF), senza window.print sulla pagina app.
 * Su web expo-print ignora l'HTML e stampa solo l'intera finestra.
 */
export function downloadFinishedProductsReportPdfWeb(
  reportRows: FinishedProductRow[]
): void {
  const totalGiacenza = reportRows.reduce((sum, row) => sum + row.giacenza_bancali, 0);
  
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Report Giacenza Prodotti Finiti", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  const dateStr = new Date().toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  doc.text(`Generato il ${dateStr} · ${reportRows.length} prodotti`, margin, y);
  y += 10;
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: y,
    head: [["Prodotto", "Giacenza"]],
    body: reportRows.map((r) => [r.nome_prodotto, formatGiacenzaForPdf(r.giacenza_bancali)]),
    foot: [["TOTALE", formatGiacenzaForPdf(totalGiacenza)]],
    showHead: "everyPage",
    showFoot: "lastPage",
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [17, 24, 39],
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [249, 115, 22],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 135 },
      1: { halign: "right", cellWidth: 33 },
    },
    margin: { left: margin, right: margin },
  });

  const fname = `report-giacenza-prodotti-finiti-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
}
