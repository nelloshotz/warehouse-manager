export interface Document {
  id: number;
  numero_documento: string;
}

export interface DocumentRow {
  id: number;
  documento_id: number;
  data_ingresso: string;
  numero_bancali_ingresso: number;
  tipologia_bancali_ingresso: string;
  uscite: {
    [key: string]: {
      data: string | null;
      bancali: number;
      giorni: number | null;
    }
  };
  note: string;
}

export interface CostSettings {
  costo_ingresso: number;
  costo_uscita: number;
  costo_storage: number;
  costo_congelato: number;
}

export interface EntrySummary {
  mese_ingresso: string;
  numero_bancali_ingresso_100x120: number;
  equivalenza_100x120: number;
  numero_bancali_ingresso_80x120: number;
  totale_bancali: number;
  costo_ingresso: number;
  costi_ingresso_normali: number;
  costi_ingresso_congelati: number;
  numero_bancali_congelato: number;
  equivalenza_bancali_congelato: number;
}

export interface ExitSummary {
  mese: string;
  tot_bancali_100x120: number;
  equivalenza_100x120: number;
  tot_bancali_80x120: number;
  costi_uscita: number;
  costi_uscita_normali: number;
  costi_uscita_congelati: number;
  totale_bancali_uscita: number;
  tot_bancali_congelato: number;
  equivalenza_congelato: number;
}

export interface StorageSummary {
  mese: string;
  stock_medio: number;
  giorni_totali: number;
  costo_storage: number;
}

export interface UploadedFile {
  id: string;
  name: string;
  uri: string;
  size: number;
  uploadDate: string;
}