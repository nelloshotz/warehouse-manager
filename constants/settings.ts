import { CostSettings } from "@/types/warehouse";

export const DEFAULT_COST_SETTINGS: CostSettings = {
  costo_ingresso: 3.86,
  costo_uscita: 3.86,
  costo_storage: 0.3,
  costo_congelato_ingresso: 7.0,
  costo_congelato_uscita: 7.0,
  costo_congelato_storage: 0.95,
};

/** Indici colonne CSV (0-based) per il report Giacenza Materie Prime */
export const RAW_MATERIALS_REPORT_CSV_COLUMNS = {
  /** Nome materia / descrizione da confrontare con prodotti.json */
  descrizione: 14,
} as const;

/**
 * Tariffe storiche. Ogni voce vale fino alla data "al" inclusa;
 * dopo l'ultima voce valgono le tariffe correnti delle Impostazioni.
 */
export const TARIFF_HISTORY: Array<{ al: string; tariffe: CostSettings }> = [
  {
    al: "2026-03-31",
    tariffe: {
      costo_ingresso: 3.5,
      costo_uscita: 3.5,
      costo_storage: 0.233333,
      costo_congelato_ingresso: 5.0,
      costo_congelato_uscita: 5.0,
      costo_congelato_storage: 0.233333,
    },
  },
];
