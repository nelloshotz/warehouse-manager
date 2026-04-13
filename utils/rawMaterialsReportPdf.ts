import type { RawMaterialRow } from "@/utils/rawMaterialsReport";

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatGiacenzaForPdf(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("it-IT", { maximumFractionDigits: 3 });
}

/** Righe PDF: se lo stato non è ancora popolato, tutto il catalogo a giacenza 0. */
export function rowsForPdf(rows: RawMaterialRow[], catalog: string[]): RawMaterialRow[] {
  if (rows.length > 0) return rows;
  return catalog.map((nome) => ({ nome_materia_prima: nome, giacenza_bancali: 0 }));
}

/**
 * HTML per expo-print (iOS/Android): tabella da dati, più pagine via CSS di stampa.
 */
export function buildReportPdfHtml(rows: RawMaterialRow[], catalog: string[]): string {
  const data = rowsForPdf(rows, catalog);
  const dataRows = data
    .map(
      (row) => `
    <tr>
      <td class="col-prodotto">${escapeHtml(row.nome_materia_prima)}</td>
      <td class="col-giacenza">${escapeHtml(formatGiacenzaForPdf(row.giacenza_bancali))}</td>
    </tr>`
    )
    .join("");

  const dataGenerazione = escapeHtml(
    new Date().toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  );

  return `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4; margin: 14mm 12mm; }
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        color: #111827;
        font-size: 11px;
        margin: 0;
        padding: 0;
      }
      .doc-header {
        margin-bottom: 12px;
        page-break-after: avoid;
      }
      h1 {
        font-size: 18px;
        margin: 0 0 6px 0;
        font-weight: 700;
      }
      .subtitle {
        font-size: 12px;
        color: #6B7280;
        margin: 0;
      }
      table.report {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      table.report thead {
        display: table-header-group;
      }
      table.report tbody {
        display: table-row-group;
      }
      table.report tr {
        page-break-inside: avoid;
      }
      table.report th,
      table.report td {
        border: 1px solid #D1D5DB;
        padding: 7px 10px;
        vertical-align: top;
        word-wrap: break-word;
      }
      table.report th {
        background: #F3F4F6;
        font-weight: 600;
        font-size: 11px;
      }
      .col-prodotto {
        width: 72%;
        text-align: left;
      }
      .col-giacenza {
        width: 28%;
        text-align: right;
        white-space: nowrap;
      }
      table.report th.col-giacenza {
        text-align: right;
      }
    </style>
  </head>
  <body>
    <div class="doc-header">
      <h1>Report Giacenza Materie Prime</h1>
      <p class="subtitle">Generato il ${dataGenerazione} · ${data.length} prodotti</p>
    </div>
    <table class="report" role="table">
      <thead>
        <tr>
          <th class="col-prodotto" scope="col">Prodotto</th>
          <th class="col-giacenza" scope="col">Giacenza</th>
        </tr>
      </thead>
      <tbody>
        ${dataRows}
      </tbody>
    </table>
  </body>
</html>`;
}
