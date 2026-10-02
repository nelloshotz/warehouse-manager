import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { STORAGE_PDF_DETAIL_HEAD, STORAGE_PDF_TOTAL_HEAD, StoragePdfReport } from "@/utils/storagePdf";

/** Colonne numeriche (Giorni, Bancali, Equiv., Costo) */
const RIGHT_ALIGNED = new Set([1, 4, 5, 6]);

const MARGIN = 14;
const COLUMN_WIDTHS = [50, 15, 20, 22, 20, 16];

/** Sottotitolo + tabella; restituisce la y finale */
function drawTable(doc: jsPDF, y: number, title: string, head: string[], rows: string[][], bold: boolean): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + 14 > pageHeight - MARGIN) {
    doc.addPage();
    y = MARGIN;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text(title, MARGIN, y + 2);
  doc.setTextColor(0, 0, 0);

  // Il dettaglio righe ha 5 colonne: si completa a 7 per allinearlo alla tabella del totale
  const pad = (cells: string[]) => [...cells, ...Array(STORAGE_PDF_TOTAL_HEAD.length - cells.length).fill("")];
  const columnStyles: Record<number, any> = {};
  COLUMN_WIDTHS.forEach((width, i) => {
    columnStyles[i] = { cellWidth: width, halign: RIGHT_ALIGNED.has(i) ? "right" : "left" };
  });
  columnStyles[6] = { halign: "right" };

  autoTable(doc, {
    startY: y + 3.5,
    head: [pad(head).map((label, i) => ({ content: label, styles: { halign: RIGHT_ALIGNED.has(i) ? "right" : "left" } }))] as any,
    body: rows.map(pad),
    showHead: "everyPage",
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.5, fontStyle: bold ? "bold" : "normal" },
    headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: "bold" },
    bodyStyles: bold ? { fillColor: [249, 250, 251] } : {},
    columnStyles,
    margin: { left: MARGIN, right: MARGIN },
  });
  return (doc as any).lastAutoTable.finalY;
}

/**
 * Web: PDF costruito dai dati con jsPDF (expo-print su web stampa solo la finestra).
 * autoTable gestisce le interruzioni di pagina e ripete l'intestazione delle tabelle.
 */
export async function exportStoragePdf(report: StoragePdfReport): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const right = pageWidth - margin;
  let y = margin + 2;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(report.title, margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(report.subtitle, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 8;

  report.sections.forEach((section) => {
    // Titolo sezione + almeno l'intestazione e una riga sulla stessa pagina
    ensureSpace(22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(section.title, margin, y);
    doc.text(section.total, right, y, { align: "right" });
    y += 4;

    if (section.exits) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      const lines = doc.splitTextToSize(section.exits, pageWidth - margin * 2);
      doc.text(lines, margin, y + 1);
      y += lines.length * 3.5 + 1;
      doc.setTextColor(0, 0, 0);
    }

    y = drawTable(doc, y, "Dettaglio righe", STORAGE_PDF_DETAIL_HEAD, section.detailRows, false);
    y = drawTable(doc, y + 2, "Calcolo sul totale documento", STORAGE_PDF_TOTAL_HEAD, section.totalRows, true);
    y += 7;
  });

  ensureSpace(10 + report.summary.length * 5 + 16);
  doc.setDrawColor(156, 163, 175);
  doc.line(margin, y - 3, right, y - 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  report.summary.forEach(([label, value]) => {
    doc.text(label, margin, y);
    doc.text(value, right, y, { align: "right" });
    y += 5;
  });
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(report.totalLabel, margin, y + 1);
  doc.text(report.total, right, y + 1, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text(doc.splitTextToSize(report.note, pageWidth - margin * 2), margin, y);

  // Numeri di pagina
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Pagina ${i} di ${pages}`, right, pageHeight - 6, { align: "right" });
  }

  doc.save(report.fileName);
}
