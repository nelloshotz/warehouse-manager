import { RAW_MATERIALS_REPORT_CSV_COLUMNS } from "@/constants/settings";

export interface RawMaterialRow {
  nome_materia_prima: string;
  giacenza_bancali: number;
}

function normalizeName(value: string): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("it-IT")
    .replace(/[‐‑–—−]/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

function getGroupLetter(name: string): string {
  const trimmed = String(name || "").trim();
  const first = trimmed.charAt(0).toLocaleUpperCase("it-IT");
  if (/[0-9]/.test(first)) return first;
  if (/[A-Z]/.test(first)) return first;
  return "~";
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

function toNumber(value: string): number {
  const trimmed = String(value || "").trim();
  if (!trimmed) return 0;

  const normalized = trimmed
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Date nel formato italiano GG/MM/AAAA (come in utils/csvParser).
 * Non usare M/G/A americano: altrimenti le uscite non risultano mai “passate” e la giacenza resta errata.
 */
function parseDate(value: string): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;

  const part1 = Number.parseInt(match[1], 10);
  const part2 = Number.parseInt(match[2], 10);
  let year = Number.parseInt(match[3], 10);
  if (year < 100) year = year <= 50 ? 2000 + year : 1900 + year;

  let month: number;
  let day: number;

  if (part1 > 12) {
    day = part1;
    month = part2;
  } else if (part2 > 12) {
    month = part1;
    day = part2;
  } else {
    day = part1;
    month = part2;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Scorre le righe CSV in ordine (dopo l’intestazione). Per ogni riga calcola la
 * giacenza bancali come per i pallet (ingresso meno uscite con data ≤ data di
 * riferimento). Se il testo nella colonna prodotto coincide (normalizzato) con
 * una voce dell’elenco `products`, somma quella giacenza al totale di quella
 * materia; righe diverse con la stessa materia si accumulano, cambio materia
 * aggiorna un altro accumulatore.
 */
export function buildRawMaterialsReportFromCsv(
  csvText: string,
  products: string[],
  referenceDate: Date = new Date(),
  descrizioneColumnIndex: number = RAW_MATERIALS_REPORT_CSV_COLUMNS.descrizione
): RawMaterialRow[] {
  const today = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );

  const productIndexMap = new Map<string, number>();
  products.forEach((name, idx) => {
    productIndexMap.set(normalizeName(name), idx);
  });

  const totals = new Array(products.length).fill(0);
  const lines = String(csvText || "").split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) {
    return products.map((nome) => ({ nome_materia_prima: nome, giacenza_bancali: 0 }));
  }

  // indici CSV (0-based), separati dal parser principale per non impattarlo
  const INGRESSO_BANCALI_INDEX = 19;
  const USCITE_DATE_COLUMNS = [27, 33, 39, 45, 51, 57, 63, 69, 75, 81, 87, 93, 99, 105, 111];
  const USCITE_BANCALI_COLUMNS = [26, 32, 38, 44, 50, 56, 62, 68, 74, 80, 86, 92, 98, 104, 110];

  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i], ";");
    const descrizione = normalizeName(row[descrizioneColumnIndex] || "");
    if (!descrizione) continue;

    const productPos = productIndexMap.get(descrizione);
    if (productPos === undefined) continue;

    const ingresso = Math.max(0, toNumber(row[INGRESSO_BANCALI_INDEX] || ""));
    if (ingresso <= 0) continue;

    let usciteValide = 0;
    for (let j = 0; j < USCITE_DATE_COLUMNS.length; j += 1) {
      const uscitaDate = parseDate(row[USCITE_DATE_COLUMNS[j]] || "");
      const uscitaBancali = toNumber(row[USCITE_BANCALI_COLUMNS[j]] || "");
      if (!uscitaDate || uscitaBancali <= 0) continue;
      if (uscitaDate <= today) usciteValide += uscitaBancali;
    }

    const giacenzaRiga = Math.max(0, ingresso - usciteValide);
    totals[productPos] += giacenzaRiga;
  }

  return products
    .map((nome, idx) => ({
      nome_materia_prima: nome,
      giacenza_bancali: Number(totals[idx].toFixed(3)),
    }))
    .sort((a, b) => {
      const letterA = getGroupLetter(a.nome_materia_prima);
      const letterB = getGroupLetter(b.nome_materia_prima);
      const isNumberA = /[0-9]/.test(letterA);
      const isNumberB = /[0-9]/.test(letterB);
      const isLetterA = /[A-Z]/.test(letterA);
      const isLetterB = /[A-Z]/.test(letterB);

      if (isNumberA !== isNumberB) return isNumberA ? -1 : 1;
      if (isLetterA !== isLetterB) return isLetterA ? -1 : 1;

      if (letterA !== letterB) {
        return letterA.localeCompare(letterB, "it", { sensitivity: "base", numeric: true });
      }

      const zeroA = a.giacenza_bancali === 0 ? 0 : 1;
      const zeroB = b.giacenza_bancali === 0 ? 0 : 1;
      if (zeroA !== zeroB) return zeroA - zeroB;

      return a.nome_materia_prima.localeCompare(b.nome_materia_prima, "it", {
        sensitivity: "base",
      });
    });
}
