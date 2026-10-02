import { CostSettings } from "@/types/warehouse";
import { formatCurrency, formatMonth } from "@/utils/calculations";
import { DocumentMonthStorage, splitByRegime } from "@/utils/storageCalculation";

/**
 * Modello dati comune per i PDF di dettaglio stoccaggio (documento e mese).
 * Il rendering avviene in storagePdfExport(.web).ts.
 */

export const STORAGE_PDF_DETAIL_HEAD = ["Periodo", "Giorni", "Tipo", "Regime", "Bancali"];
export const STORAGE_PDF_TOTAL_HEAD = ["Periodo", "Giorni", "Tipo", "Regime", "Bancali tot.", "Equiv.", "Costo"];

export interface StoragePdfSection {
  title: string;
  total: string;
  exits: string | null;
  /** Dettaglio riga per riga (solo bancali) */
  detailRows: string[][];
  /** Calcolo sul totale documento (equivalenza e costo) */
  totalRows: string[][];
}

export interface StoragePdfReport {
  title: string;
  subtitle: string;
  fileName: string;
  sections: StoragePdfSection[];
  summary: Array<[string, string]>;
  totalLabel: string;
  total: string;
  note: string;
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function regime(congelato: boolean): string {
  return congelato ? "Congelato" : "Ambient";
}

function exitsText(entry: DocumentMonthStorage): string | null {
  const uscite = entry.righe
    .flatMap((r) => r.usciteNelMese.map((u) => ({ ...u, tipologia: r.tipologia, congelato: r.congelato })))
    .sort((a, b) => a.data.localeCompare(b.data));
  if (uscite.length === 0) return null;
  return (
    "Uscite: " +
    uscite
      .map((u) => `${formatDate(u.data)} · ${u.bancali} bancali ${u.tipologia} ${regime(u.congelato).toLowerCase()}`)
      .join(" — ")
  );
}

function section(title: string, entry: DocumentMonthStorage): StoragePdfSection {
  return {
    title,
    total: formatCurrency(entry.costo),
    exits: exitsText(entry),
    detailRows: entry.righe.flatMap((r) =>
      r.periodi.map((p) => [
        `${formatDate(p.dal)} – ${formatDate(p.al)}`,
        String(p.giorni),
        r.tipologia,
        regime(r.congelato),
        String(p.bancali),
      ])
    ),
    totalRows: entry.gruppi.flatMap((g) =>
      g.periodi.map((p) => [
        `${formatDate(p.dal)} – ${formatDate(p.al)}`,
        String(p.giorni),
        g.tipologia,
        regime(g.congelato),
        String(p.bancali),
        String(p.equivalenti),
        formatCurrency(p.costo),
      ])
    ),
  };
}

function totals(entries: DocumentMonthStorage[]) {
  const { ambient, congelato } = splitByRegime(entries);
  return { ambient, congelato, totale: ambient + congelato };
}

function generatedOn(): string {
  return new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function rateNote(costSettings: CostSettings): string {
  return (
    `Tariffe: ambient ${formatCurrency(costSettings.costo_storage)} · congelato ` +
    `${formatCurrency(costSettings.costo_congelato_storage)} per bancale equivalente al giorno. ` +
    `Il giorno di ingresso è conteggiato; dal giorno di uscita lo stoccaggio è calcolato sui bancali rimanenti. ` +
    `L'equivalenza è calcolata sul totale dei bancali del documento, per tipologia e regime.`
  );
}

function safeFileName(text: string): string {
  return text.replace(/[^a-zA-Z0-9-]+/g, "-");
}

/** PDF del dettaglio stoccaggio di un documento: una sezione per mese. */
export function buildDocumentStoragePdf(
  numeroDocumento: string,
  entries: DocumentMonthStorage[],
  costSettings: CostSettings
): StoragePdfReport {
  const t = totals(entries);
  return {
    title: `Stoccaggio mese per mese · Documento ${numeroDocumento}`,
    subtitle: `Generato il ${generatedOn()} · ${entries.length} mesi`,
    fileName: `stoccaggio-documento-${safeFileName(numeroDocumento)}.pdf`,
    sections: entries.map((entry) => section(capitalize(formatMonth(entry.mese)), entry)),
    summary: [
      ["di cui ambient", formatCurrency(t.ambient)],
      ["di cui congelato", formatCurrency(t.congelato)],
    ],
    totalLabel: "Totale stoccaggio documento",
    total: formatCurrency(t.totale),
    note: rateNote(costSettings),
  };
}

/** PDF del dettaglio stoccaggio di un mese: una sezione per documento. */
export function buildMonthStoragePdf(
  monthKey: string,
  documenti: DocumentMonthStorage[],
  costSettings: CostSettings
): StoragePdfReport {
  const t = totals(documenti);
  const meseLabel = capitalize(formatMonth(monthKey));
  return {
    title: `Dettaglio stoccaggio · ${meseLabel}`,
    subtitle: `Generato il ${generatedOn()} · ${documenti.length} documenti`,
    fileName: `stoccaggio-${monthKey}.pdf`,
    sections: documenti.map((d) => section(`Documento ${d.numero_documento}`, d)),
    summary: [
      ["Documenti", String(documenti.length)],
      ["di cui ambient", formatCurrency(t.ambient)],
      ["di cui congelato", formatCurrency(t.congelato)],
    ],
    totalLabel: `Totale ${meseLabel}`,
    total: formatCurrency(t.totale),
    note: rateNote(costSettings),
  };
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlTable(head: string[], rows: string[][], cls: string): string {
  // Le colonne del dettaglio righe si allineano a quelle del totale (le ultime due restano vuote)
  const pad = (cells: string[]) => [...cells, ...Array(STORAGE_PDF_TOTAL_HEAD.length - cells.length).fill("")];
  return `<table class="${cls}">
        <thead><tr>${pad(head).map((h, i) => `<th class="c${i}">${h}</th>`).join("")}</tr></thead>
        <tbody>${rows
          .map((r) => `<tr>${pad(r).map((c, i) => `<td class="c${i}">${escapeHtml(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody>
      </table>`;
}

/** HTML per expo-print (iOS/Android); le pagine si spezzano tramite CSS di stampa. */
export function buildStoragePdfHtml(report: StoragePdfReport): string {
  const sections = report.sections
    .map(
      (s) => `
    <div class="section">
      <div class="section-head"><span>${escapeHtml(s.title)}</span><span>${escapeHtml(s.total)}</span></div>
      ${s.exits ? `<p class="exits">${escapeHtml(s.exits)}</p>` : ""}
      <p class="sub">Dettaglio righe</p>
      ${htmlTable(STORAGE_PDF_DETAIL_HEAD, s.detailRows, "")}
      <p class="sub">Calcolo sul totale documento</p>
      ${htmlTable(STORAGE_PDF_TOTAL_HEAD, s.totalRows, "total")}
    </div>`
    )
    .join("");

  const summary = report.summary
    .map(([label, value]) => `<div class="sum"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4; margin: 14mm 12mm; }
      body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #111827; font-size: 10px; margin: 0; }
      h1 { font-size: 16px; margin: 0 0 4px 0; }
      .subtitle { color: #6B7280; margin: 0 0 12px 0; font-size: 11px; }
      .section { margin-bottom: 14px; page-break-inside: avoid; }
      .section-head { display: flex; justify-content: space-between; font-weight: 700; font-size: 12px; margin-bottom: 3px; }
      .exits { color: #B45309; margin: 0 0 3px 0; }
      .sub { color: #4B5563; font-weight: 700; margin: 4px 0 2px 0; }
      table.total td { background: #F9FAFB; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      th, td { border: 1px solid #D1D5DB; padding: 3px 5px; }
      th { background: #F3F4F6; text-align: left; }
      .c0 { width: 30%; } .c1, .c4, .c5 { width: 9%; text-align: right; } .c2 { width: 11%; } .c3 { width: 12%; }
      .c6 { width: 20%; text-align: right; }
      .summary { border-top: 1px solid #9CA3AF; padding-top: 6px; margin-top: 6px; page-break-inside: avoid; }
      .sum { display: flex; justify-content: space-between; color: #4B5563; font-size: 11px; }
      .total { display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; margin-top: 4px; }
      .note { color: #6B7280; font-size: 9px; margin-top: 8px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(report.title)}</h1>
    <p class="subtitle">${escapeHtml(report.subtitle)}</p>
    ${sections}
    <div class="summary">
      ${summary}
      <div class="total"><span>${escapeHtml(report.totalLabel)}</span><span>${escapeHtml(report.total)}</span></div>
      <p class="note">${escapeHtml(report.note)}</p>
    </div>
  </body>
</html>`;
}
