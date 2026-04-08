import { DocumentRow } from "@/types/warehouse";

export interface RawMaterialRow {
  nome_materia_prima: string;
  giacenza_bancali: number;
}

function normalizeName(value: string): string {
  return String(value || "").trim().toLocaleLowerCase("it-IT");
}

function getGroupLetter(name: string): string {
  const trimmed = String(name || "").trim();
  const first = trimmed.charAt(0).toLocaleUpperCase("it-IT");
  return /[A-Z]/.test(first) ? first : "#";
}

export function buildRawMaterialsReport(
  documentRows: DocumentRow[],
  products: string[],
  referenceDate: Date = new Date()
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

  documentRows.forEach((row) => {
    const descrizione = normalizeName(row.descrizione_materia_prima || "");
    if (!descrizione) return;

    const productPos = productIndexMap.get(descrizione);
    if (productPos === undefined) return;

    const ingresso = Math.max(0, Number(row.numero_bancali_ingresso) || 0);
    if (ingresso <= 0) return;

    let usciteValide = 0;
    Object.values(row.uscite || {}).forEach((uscita) => {
      if (!uscita?.data || uscita.bancali <= 0) return;
      const exitDate = new Date(uscita.data);
      if (Number.isNaN(exitDate.getTime())) return;
      if (exitDate <= today) usciteValide += uscita.bancali;
    });

    const giacenzaRiga = Math.max(0, ingresso - usciteValide);
    totals[productPos] += giacenzaRiga;
  });

  return products
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
}
