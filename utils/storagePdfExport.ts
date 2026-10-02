import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { buildStoragePdfHtml, StoragePdfReport } from "@/utils/storagePdf";

/** iOS/Android: PDF da HTML con expo-print, poi condivisione. */
export async function exportStoragePdf(report: StoragePdfReport): Promise<void> {
  const file = await Print.printToFileAsync({ html: buildStoragePdfHtml(report) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      dialogTitle: report.title,
      UTI: "com.adobe.pdf",
    });
  }
}
