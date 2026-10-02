import { CostSettings, DocumentRow } from "@/types/warehouse";
import { calculateEquivalence } from "@/utils/calculations";

/**
 * Calcolo dello stoccaggio mese per mese, raggruppato per documento.
 *
 * Regole:
 * - Il conto si chiude a fine mese: ogni mese ha il suo totale.
 * - Il giorno di ingresso è conteggiato.
 * - Il giorno di uscita lo stock è già aggiornato ai bancali rimanenti
 *   (i bancali usciti sono addebitati come uscita, non come stoccaggio).
 * - Le righe dello stesso documento si sommano giorno per giorno per tipologia
 *   e regime; l'equivalenza (100x120) si calcola sul totale del documento,
 *   non sulla singola riga. 80x120: 1:1.
 * - Righe con nota "CONGELATO": regime congelato, tariffa congelato.
 * - Il mese corrente è conteggiato fino ad oggi.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type Tipologia = "100x120" | "80x120";

/** Periodo di una singola riga: solo bancali (l'equivalenza è sul totale documento) */
export interface RowPeriod {
  dal: string; // YYYY-MM-DD
  al: string; // YYYY-MM-DD
  giorni: number;
  bancali: number;
}

export interface RowMonthStorage {
  mese: string; // YYYY-MM
  rowId: number;
  documentoId: number;
  dataIngresso: string;
  tipologia: Tipologia;
  congelato: boolean;
  bancaliInizioMese: number;
  bancaliFineMese: number;
  usciteNelMese: Array<{ data: string; bancali: number }>;
  periodi: RowPeriod[];
  giorniConteggiati: number; // giorni del mese in cui la riga era in magazzino
}

/** Periodo sul totale documento per una tipologia/regime */
export interface GroupPeriod extends RowPeriod {
  equivalenti: number;
  costo: number;
}

export interface GroupMonthStorage {
  tipologia: Tipologia;
  congelato: boolean;
  tariffa: number;
  periodi: GroupPeriod[];
  giorniBancale: number; // Σ giorni × equivalenti
  costo: number;
}

export interface DocumentMonthStorage {
  mese: string;
  numero_documento: string;
  righe: RowMonthStorage[];
  gruppi: GroupMonthStorage[];
  costo: number;
}

function toDayIndex(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (isNaN(time)) return null;
  return Math.floor(time / MS_PER_DAY);
}

function dayToISO(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().split("T")[0];
}

function monthKeyOfDay(day: number): string {
  return dayToISO(day).substring(0, 7);
}

function todayIndex(): number {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / MS_PER_DAY);
}

function rowTipologia(row: DocumentRow): Tipologia {
  return row.tipologia_bancali_ingresso.toUpperCase() === "100X120" ? "100x120" : "80x120";
}

function rowCongelato(row: DocumentRow): boolean {
  return (row.note || "").toUpperCase().includes("CONGELATO");
}

/**
 * Bancali di una riga per ogni mese, dall'ingresso a oggi (senza equivalenza né costo).
 */
export function calculateRowStorage(row: DocumentRow, today: number = todayIndex()): RowMonthStorage[] {
  const startDay = toDayIndex(row.data_ingresso);
  if (startDay === null || startDay > today) return [];

  // Uscite valide fino ad oggi, ordinate; un'uscita datata prima dell'ingresso vale dal giorno di ingresso
  const uscite = Object.values(row.uscite || {})
    .map((u) => ({ day: toDayIndex(u.data), bancali: u.bancali }))
    .filter((u): u is { day: number; bancali: number } => u.day !== null && u.bancali > 0)
    .map((u) => ({ day: Math.max(u.day, startDay), bancali: u.bancali }))
    .filter((u) => u.day <= today)
    .sort((a, b) => a.day - b.day);

  const result: RowMonthStorage[] = [];
  let remaining = row.numero_bancali_ingresso;
  let exitIdx = 0;
  let monthFirstDay = toDayIndex(`${monthKeyOfDay(startDay)}-01`)!;

  while (monthFirstDay <= today && remaining > 0) {
    const d = new Date(monthFirstDay * MS_PER_DAY);
    const monthLastDay = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0) / MS_PER_DAY);
    const from = Math.max(monthFirstDay, startDay);
    const to = Math.min(monthLastDay, today);

    const bancaliInizioMese = remaining;
    const usciteNelMese: Array<{ data: string; bancali: number }> = [];
    const periodi: RowPeriod[] = [];
    let cursor = from;

    const chiudiPeriodo = (fine: number) => {
      if (fine < cursor || remaining <= 0) return;
      periodi.push({ dal: dayToISO(cursor), al: dayToISO(fine), giorni: fine - cursor + 1, bancali: remaining });
    };

    while (exitIdx < uscite.length && uscite[exitIdx].day <= to) {
      const uscita = uscite[exitIdx];
      // Fino al giorno prima dell'uscita vale lo stock precedente
      chiudiPeriodo(uscita.day - 1);
      remaining = Math.max(0, remaining - uscita.bancali);
      cursor = Math.max(cursor, uscita.day);
      usciteNelMese.push({ data: dayToISO(uscita.day), bancali: uscita.bancali });
      exitIdx++;
    }
    chiudiPeriodo(to);

    // Un mese senza periodi (es. entrati e usciti lo stesso giorno) non ha stoccaggio
    if (periodi.length > 0) {
      result.push({
        mese: monthKeyOfDay(monthFirstDay),
        rowId: row.id,
        documentoId: row.documento_id,
        dataIngresso: row.data_ingresso,
        tipologia: rowTipologia(row),
        congelato: rowCongelato(row),
        bancaliInizioMese,
        bancaliFineMese: remaining,
        usciteNelMese,
        periodi,
        giorniConteggiati: to - from + 1,
      });
    }

    monthFirstDay = monthLastDay + 1;
  }

  return result;
}

/**
 * Somma giorno per giorno le righe di un documento nello stesso mese, per tipologia e regime,
 * e calcola equivalenza e costo sul totale.
 */
function groupMonth(righe: RowMonthStorage[], costSettings: CostSettings): GroupMonthStorage[] {
  const keys = Array.from(new Set(righe.map((r) => `${r.tipologia}|${r.congelato}`))).sort();

  return keys.map((key) => {
    const [tipologia, congelatoStr] = key.split("|") as [Tipologia, string];
    const congelato = congelatoStr === "true";
    const tariffa = congelato ? costSettings.costo_congelato_storage : costSettings.costo_storage;
    const equivalenza = (bancali: number) => (tipologia === "100x120" ? calculateEquivalence(bancali) : bancali);

    // Bancali totali per giorno
    const perDay = new Map<number, number>();
    righe
      .filter((r) => r.tipologia === tipologia && r.congelato === congelato)
      .forEach((r) =>
        r.periodi.forEach((p) => {
          const end = toDayIndex(p.al)!;
          for (let day = toDayIndex(p.dal)!; day <= end; day++) {
            perDay.set(day, (perDay.get(day) || 0) + p.bancali);
          }
        })
      );

    // Comprimi i giorni consecutivi con lo stesso totale in periodi
    const days = Array.from(perDay.keys()).sort((a, b) => a - b);
    const periodi: GroupPeriod[] = [];
    days.forEach((day) => {
      const bancali = perDay.get(day)!;
      const last = periodi[periodi.length - 1];
      if (last && last.bancali === bancali && toDayIndex(last.al)! === day - 1) {
        last.al = dayToISO(day);
        last.giorni += 1;
      } else {
        periodi.push({ dal: dayToISO(day), al: dayToISO(day), giorni: 1, bancali, equivalenti: equivalenza(bancali), costo: 0 });
      }
    });
    periodi.forEach((p) => {
      p.costo = p.giorni * p.equivalenti * tariffa;
    });

    return {
      tipologia,
      congelato,
      tariffa,
      periodi,
      giorniBancale: periodi.reduce((sum, p) => sum + p.giorni * p.equivalenti, 0),
      costo: periodi.reduce((sum, p) => sum + p.costo, 0),
    };
  });
}

/**
 * Stoccaggio mese per mese di un documento (tutte le sue righe).
 */
export function calculateDocumentStorage(
  numeroDocumento: string,
  rows: DocumentRow[],
  costSettings: CostSettings,
  today: number = todayIndex()
): DocumentMonthStorage[] {
  const byMonth = new Map<string, RowMonthStorage[]>();
  rows.forEach((row) =>
    calculateRowStorage(row, today).forEach((entry) => {
      const list = byMonth.get(entry.mese);
      if (list) list.push(entry);
      else byMonth.set(entry.mese, [entry]);
    })
  );

  return Array.from(byMonth.keys())
    .sort()
    .map((mese) => {
      const righe = byMonth.get(mese)!;
      const gruppi = groupMonth(righe, costSettings);
      return {
        mese,
        numero_documento: numeroDocumento,
        righe,
        gruppi,
        costo: gruppi.reduce((sum, g) => sum + g.costo, 0),
      };
    });
}

/**
 * Stoccaggio di tutti i documenti, raggruppato per mese.
 * Le righe sono raggruppate per numero documento (più ID con lo stesso numero = stesso documento).
 */
export function calculateStorageByMonth(
  documents: Array<{ id: number; numero_documento: string }>,
  rows: DocumentRow[],
  costSettings: CostSettings
): Map<string, DocumentMonthStorage[]> {
  const today = todayIndex();
  const numeroById = new Map(documents.map((d) => [d.id, d.numero_documento]));
  const rowsByDocument = new Map<string, DocumentRow[]>();
  rows.forEach((row) => {
    const numero = numeroById.get(row.documento_id) || `ID ${row.documento_id}`;
    const list = rowsByDocument.get(numero);
    if (list) list.push(row);
    else rowsByDocument.set(numero, [row]);
  });

  const byMonth = new Map<string, DocumentMonthStorage[]>();
  rowsByDocument.forEach((docRows, numero) => {
    calculateDocumentStorage(numero, docRows, costSettings, today).forEach((entry) => {
      const list = byMonth.get(entry.mese);
      if (list) list.push(entry);
      else byMonth.set(entry.mese, [entry]);
    });
  });
  return byMonth;
}

/** Totali ambient / congelato */
export function splitByRegime(entries: DocumentMonthStorage[]) {
  return entries.reduce(
    (acc, e) => {
      e.gruppi.forEach((g) => {
        if (g.congelato) acc.congelato += g.costo;
        else acc.ambient += g.costo;
      });
      return acc;
    },
    { ambient: 0, congelato: 0 }
  );
}

/**
 * Bancali in magazzino a fine mese (oggi se il mese è in corso), per regime.
 * Equivalenti calcolati sul totale di ciascun documento.
 */
export function stockAtMonthEnd(entries: DocumentMonthStorage[], monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = Math.min(Math.floor(Date.UTC(y, m, 0) / MS_PER_DAY), todayIndex());
  const lastISO = dayToISO(lastDay);
  const result = {
    ambient: { bancali: 0, equivalenti: 0 },
    congelato: { bancali: 0, equivalenti: 0 },
  };
  entries.forEach((e) =>
    e.gruppi.forEach((g) => {
      const last = g.periodi[g.periodi.length - 1];
      if (!last || last.al !== lastISO) return; // gruppo uscito prima di fine mese
      const target = g.congelato ? result.congelato : result.ambient;
      target.bancali += last.bancali;
      target.equivalenti += last.equivalenti;
    })
  );
  return result;
}
