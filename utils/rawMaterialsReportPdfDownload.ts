import type { RawMaterialRow } from "@/utils/rawMaterialsReport";

/** Su native si usa expo-print; questa funzione non deve essere chiamata. */
export function downloadRawMaterialsReportPdfWeb(
  _rows: RawMaterialRow[],
  _catalog: string[]
): void {
  throw new Error("downloadRawMaterialsReportPdfWeb è solo per web.");
}
