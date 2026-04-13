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
