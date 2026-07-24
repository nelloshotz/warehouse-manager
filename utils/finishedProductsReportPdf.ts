import type { FinishedProductRow } from "@/utils/finishedProductsReport";

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

export function formatTotaleForPdf(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("it-IT");
}

/**
 * HTML per expo-print (iOS/Android): tabella da dati, più pagine via CSS di stampa.
 */
export function buildReportPdfHtml(rows: FinishedProductRow[]): string {
  const totalGiacenza = rows.reduce((sum, row) => sum + row.giacenza_bancali, 0);
  
  const dataRows = rows
    .map(
      (row) => `
    <tr>
      <td class="col-prodotto">${escapeHtml(row.nome_prodotto)}</td>
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
      .total-row {
        background: #F97316;
        font-weight: 700;
        color: #FFFFFF;
      }
      .total-row td {
        padding: 10px;
        border-color: #EA580C;
      }
    </style>
  </head>
  <body>
    <div class="doc-header">
      <h1>Report Giacenza Prodotti Finiti</h1>
      <p class="subtitle">Generato il ${dataGenerazione} · ${rows.length} prodotti</p>
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
        <tr class="total-row">
          <td class="col-prodotto">TOTALE</td>
          <td class="col-giacenza">${escapeHtml(formatTotaleForPdf(totalGiacenza))}</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`;
}
