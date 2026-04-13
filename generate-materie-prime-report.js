const fs = require("fs");

const CSV_PATH = "Magazzino Casilli Teverola - Generale new-6.csv";
const PRODUCTS_PATH = "prodotti.json";
const OUTPUT_PATH = "report-giacenza-materie-prime.json";

function parseCsvLine(line, delimiter = ";") {
  const out = [];
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

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;

  const trimmed = value.trim();
  if (!trimmed) return 0;

  const normalized = trimmed
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeName(value) {
  return String(value || "").trim().toLocaleLowerCase("it-IT");
}

function parseDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;

  const part1 = Number.parseInt(match[1], 10);
  const part2 = Number.parseInt(match[2], 10);
  let year = Number.parseInt(match[3], 10);
  if (year < 100) year = year <= 50 ? 2000 + year : 1900 + year;

  let month;
  let day;
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

function main() {
  const rawProducts = fs.readFileSync(PRODUCTS_PATH, "utf8");
  const parsedProducts = JSON.parse(rawProducts);
  const products = Array.isArray(parsedProducts.prodotti) ? parsedProducts.prodotti : [];

  if (products.length === 0) {
    throw new Error('Il file prodotti.json non contiene "prodotti".');
  }

  const csvRaw = fs.readFileSync(CSV_PATH, "utf8");
  const lines = csvRaw.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) {
    throw new Error("CSV vuoto o senza righe dati.");
  }

  const header = parseCsvLine(lines[0], ";");

  const DESCRIZIONE_INDEX = 14;
  const INGRESSO_BANCALI_INDEX = 19;
  const USCITE_DATE_COLUMNS = [27, 33, 39, 45, 51, 57, 63, 69, 75, 81, 87, 93, 99, 105, 111];
  const USCITE_BANCALI_COLUMNS = [26, 32, 38, 44, 50, 56, 62, 68, 74, 80, 86, 92, 98, 104, 110];

  const productIndexMap = new Map();
  products.forEach((name, idx) => {
    productIndexMap.set(normalizeName(name), idx);
  });

  const totals = new Array(products.length).fill(0);

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const row = parseCsvLine(lines[lineIndex], ";");
    const descrizione = normalizeName(row[DESCRIZIONE_INDEX]);
    if (!descrizione) continue;

    const productPos = productIndexMap.get(descrizione);
    if (productPos === undefined) continue;

    const ingresso = toNumber(row[INGRESSO_BANCALI_INDEX]);
    if (ingresso <= 0) continue;

    let usciteValide = 0;
    for (let j = 0; j < USCITE_DATE_COLUMNS.length; j += 1) {
      const dataIdx = USCITE_DATE_COLUMNS[j];
      const bancaliIdx = USCITE_BANCALI_COLUMNS[j];
      const uscitaDate = parseDate(row[dataIdx]);
      const uscitaBancali = toNumber(row[bancaliIdx]);

      if (!uscitaDate || uscitaBancali <= 0) continue;
      if (uscitaDate <= today) {
        usciteValide += uscitaBancali;
      }
    }

    // Stessa regola usata nel calcolo giacenza: ingresso - uscite (mai negativo)
    const giacenzaRiga = Math.max(0, ingresso - usciteValide);
    totals[productPos] += giacenzaRiga;
  }

  const getGroupLetter = (name) => {
    const trimmed = String(name || "").trim();
    const first = trimmed.charAt(0).toLocaleUpperCase("it-IT");
    return /[A-Z]/.test(first) ? first : "#";
  };

  const reportRows = products
    .map((nome, idx) => ({
      nome_materia_prima: nome,
      giacenza_bancali: Number(totals[idx].toFixed(3)),
    }))
    .sort((a, b) => {
      const letterA = getGroupLetter(a.nome_materia_prima);
      const letterB = getGroupLetter(b.nome_materia_prima);

      if (letterA !== letterB) {
        if (letterA === "#") return 1;
        if (letterB === "#") return -1;
        return letterA.localeCompare(letterB, "it", { sensitivity: "base" });
      }

      const zeroA = a.giacenza_bancali === 0 ? 0 : 1;
      const zeroB = b.giacenza_bancali === 0 ? 0 : 1;
      if (zeroA !== zeroB) return zeroA - zeroB;

      return a.nome_materia_prima.localeCompare(b.nome_materia_prima, "it", {
        sensitivity: "base",
      });
    });

  const output = {
    metadata: {
      csv_file: CSV_PATH,
      descrizione_colonna_indice: DESCRIZIONE_INDEX,
      descrizione_colonna_nome: header[DESCRIZIONE_INDEX] || "DESCRIZIONE",
      giacenza_bancali_indice: INGRESSO_BANCALI_INDEX,
      giacenza_bancali_colonna_nome: header[INGRESSO_BANCALI_INDEX] || "Q.TA PLT",
      uscite_date_indici: USCITE_DATE_COLUMNS,
      uscite_bancali_indici: USCITE_BANCALI_COLUMNS,
      data_riferimento_giacenza_utc: today.toISOString(),
      totale_prodotti_in_lista: products.length,
      prodotti_trovati_con_giacenza_gt_0: reportRows.filter((r) => r.giacenza_bancali > 0).length,
    },
    report: reportRows,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");

  console.log("Report creato:", OUTPUT_PATH);
  console.log("Prodotti in lista:", products.length);
  console.log(
    "Prodotti con giacenza > 0:",
    output.metadata.prodotti_trovati_con_giacenza_gt_0
  );
}

main();
