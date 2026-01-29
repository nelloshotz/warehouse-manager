/**
 * Funzioni di utilità per i calcoli del magazzino
 */

// Calcola equivalenza per i bancali
export function calculateEquivalence(pallets: number): number {
  const equivalenze = [0, 2, 3, 4, 5, 7, 8, 9, 10, 12, 13, 14, 15, 17, 18, 19, 20, 22, 23, 24, 25, 27, 28, 29, 30, 32, 33];
  const blocchi = Math.floor(pallets / 26);
  const resto = pallets % 26;
  return blocchi * 33 + equivalenze[resto];
}

// Formatta valuta
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

// Formatta data
export function formatDate(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("it-IT");
}

// Genera mesi tra due date
export function generateMonthsBetween(startDate: Date, endDate: Date): string[] {
  const months: string[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    months.push(currentDate.toISOString().substring(0, 7)); // YYYY-MM format
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return months;
}

// Formatta mese per visualizzazione
export function formatMonth(monthString: string): string {
  const date = new Date(monthString + "-01");
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}