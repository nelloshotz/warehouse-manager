import { CostSettings } from "@/types/warehouse";
import { TARIFF_HISTORY } from "@/constants/settings";

/** YYYY-MM-DD di una data (stringa ISO o Date) */
function isoDay(date: string | Date): string {
  return (typeof date === "string" ? date : date.toISOString()).substring(0, 10);
}

function formatIt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().substring(0, 10);
}

/** Indice del periodo tariffario di una data (TARIFF_HISTORY.length = tariffe correnti) */
export function tariffPeriodIndex(date: string | Date): number {
  const day = isoDay(date);
  const idx = TARIFF_HISTORY.findIndex((p) => day <= p.al);
  return idx === -1 ? TARIFF_HISTORY.length : idx;
}

/** Tariffe in vigore in una data: storiche se precedenti, altrimenti quelle delle Impostazioni */
export function costSettingsForDate(date: string | Date, current: CostSettings): CostSettings {
  const idx = tariffPeriodIndex(date);
  return idx < TARIFF_HISTORY.length ? TARIFF_HISTORY[idx].tariffe : current;
}

/** Descrizione del periodo tariffario, es. "fino al 31/03/2026" o "dal 01/04/2026" */
export function tariffPeriodLabel(date: string | Date): string {
  const idx = tariffPeriodIndex(date);
  if (idx < TARIFF_HISTORY.length) {
    const from = idx > 0 ? nextDay(TARIFF_HISTORY[idx - 1].al) : null;
    return from
      ? `dal ${formatIt(from)} al ${formatIt(TARIFF_HISTORY[idx].al)}`
      : `fino al ${formatIt(TARIFF_HISTORY[idx].al)}`;
  }
  return TARIFF_HISTORY.length > 0
    ? `dal ${formatIt(nextDay(TARIFF_HISTORY[TARIFF_HISTORY.length - 1].al))}`
    : "tariffe correnti";
}
