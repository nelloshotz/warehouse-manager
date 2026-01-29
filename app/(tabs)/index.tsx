import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useWarehouseStore } from "@/store/warehouseStore";
import { colors } from "@/constants/colors";
import { 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Clock, 
  Database,
  Package
} from "lucide-react-native";
import SummaryCard from "@/components/SummaryCard";
import AppLayout from "@/components/AppLayout";
import MonthlyTotalsCard from "@/components/MonthlyTotalsCard";
import { formatCurrency, formatMonth } from "@/utils/calculations";

export default function DashboardScreen() {
  const { 
    entrySummaries, 
    exitSummaries, 
    storageSummaries,
    calculateSummaries,
    isLoading,
    calculateProjectedStorage,
    getStorageDetailsByMonth
  } = useWarehouseStore();
  
  useEffect(() => {
    calculateSummaries();
  }, []);
  
  // Ottieni i dati per il mese corrente
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const currentEntrySummary = entrySummaries.find(s => s.mese_ingresso === currentMonthKey);
  const currentExitSummary = exitSummaries.find(s => s.mese === currentMonthKey);
  const currentStorageSummary = storageSummaries.find(s => s.mese === currentMonthKey);

  const currentMonthEntryCost = currentEntrySummary?.costo_ingresso || 0;
  const currentMonthExitCost = currentExitSummary?.costi_uscita || 0;
  const currentMonthStorageCost = currentStorageSummary?.costo_storage || 0;
  // La funzione calculateProjectedStorage ora calcola lo stock attuale internamente
  const currentMonthProjectedStorageCost = calculateProjectedStorage(0, currentMonthKey);
  const [currentStorageDetails, setCurrentStorageDetails] = useState({ 
    pallets100x120: 0, 
    pallets80x120: 0, 
    equivalentPallets: 0, 
    totalPallets: 0,
    palletsCongelato100x120: 0,
    palletsCongelato80x120: 0,
    totalPalletsCongelato: 0,
    equivalentPalletsCongelato: 0
  });
  const [last3MonthsStorageDetails, setLast3MonthsStorageDetails] = useState<Record<string, any>>({});
  
  // Carica i dettagli storage in modo asincrono
  useEffect(() => {
    const loadStorageDetails = async () => {
      const details = await getStorageDetailsByMonth(currentMonthKey);
      setCurrentStorageDetails(details);
      
      // Carica anche i dettagli per i 3 mesi precedenti
      const detailsMap: Record<string, any> = {};
      for (let i = 1; i <= 3; i++) {
        const date = new Date();
        date.setMonth(today.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthDetails = await getStorageDetailsByMonth(monthKey);
        detailsMap[monthKey] = monthDetails;
      }
      setLast3MonthsStorageDetails(detailsMap);
    };
    loadStorageDetails();
  }, [currentMonthKey]);

  // Log per verificare i dati del mese corrente
  console.log(`=== DASHBOARD - Mese Corrente (${currentMonthKey}) ===`);
  console.log('Entry Summary trovato:', currentEntrySummary ? 'Sì' : 'No', currentEntrySummary ? `- Costo: ${currentMonthEntryCost}` : '');
  console.log('Exit Summary trovato:', currentExitSummary ? 'Sì' : 'No', currentExitSummary ? `- Costo: ${currentMonthExitCost}` : '');
  console.log('Storage Summary trovato:', currentStorageSummary ? 'Sì' : 'No', currentStorageSummary ? `- Costo: ${currentMonthStorageCost}` : '');
  console.log('Totale mese corrente:', currentMonthEntryCost + currentMonthExitCost + currentMonthStorageCost);

  // Funzione per ottenere il nome del mese in italiano
  const getMonthName = (monthKey: string): string => {
    return formatMonth(monthKey);
  };

  // Ottieni i dati per i 3 mesi precedenti (escludendo il corrente)
  const last3MonthsData = [];
  for (let i = 1; i <= 3; i++) {
    const date = new Date();
    date.setMonth(today.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    const entry = entrySummaries.find(s => s.mese_ingresso === monthKey);
    const exit = exitSummaries.find(s => s.mese === monthKey);
    const storage = storageSummaries.find(s => s.mese === monthKey);

    const entryCost = entry?.costo_ingresso || 0;
    const exitCost = exit?.costi_uscita || 0;
    const storageCost = storage?.costo_storage || 0;
    const totalMonth = entryCost + exitCost + storageCost;

    // Log per ogni mese
    console.log(`=== Mese ${monthKey} (${i} mesi fa) ===`);
    console.log(`  Entry: ${entryCost} (trovato: ${entry ? 'Sì' : 'No'})`);
    console.log(`  Exit: ${exitCost} (trovato: ${exit ? 'Sì' : 'No'})`);
    console.log(`  Storage: ${storageCost} (trovato: ${storage ? 'Sì' : 'No'})`);
    console.log(`  Totale mese: ${totalMonth}`);

    const storageDetails = last3MonthsStorageDetails[monthKey] || { pallets100x120: 0, pallets80x120: 0, equivalentPallets: 0, totalPallets: 0 };
    
    last3MonthsData.push({
      monthKey,
      monthName: getMonthName(monthKey),
      entryCost,
      exitCost,
      storageCost,
      entrySummary: entry,
      exitSummary: exit,
      storageDetails,
    });
  }
  
  // Totali generali (TUTTI i mesi, non solo quelli visualizzati)
  const totalEntries = entrySummaries.reduce((sum, entry) => sum + entry.costo_ingresso, 0);
  const totalExits = exitSummaries.reduce((sum, exit) => sum + exit.costi_uscita, 0);
  const totalStorage = storageSummaries.reduce((sum, storage) => sum + storage.costo_storage, 0);
  const totalCost = totalEntries + totalExits + totalStorage;
  
  const totalPallets = entrySummaries.reduce((sum, entry) => sum + entry.totale_bancali, 0);

  // Log per verificare i totali generali
  console.log(`=== TOTALI GENERALI (TUTTI I MESI) ===`);
  console.log(`  Totale Entry Summaries: ${entrySummaries.length} mesi`);
  console.log(`  Totale Exit Summaries: ${exitSummaries.length} mesi`);
  console.log(`  Totale Storage Summaries: ${storageSummaries.length} mesi`);
  console.log(`  Costo totale ingressi: ${totalEntries}`);
  console.log(`  Costo totale uscite: ${totalExits}`);
  console.log(`  Costo totale storage: ${totalStorage}`);
  console.log(`  Costo totale complessivo: ${totalCost}`);
  console.log(`  Totale bancali: ${totalPallets}`);
  
  // Verifica che ogni mese visualizzato mostri solo i suoi dati
  console.log(`\n=== VERIFICA FILTRI PER MESE ===`);
  entrySummaries.forEach(entry => {
    console.log(`  Entry ${entry.mese_ingresso}: ${entry.costo_ingresso}`);
  });
  exitSummaries.forEach(exit => {
    console.log(`  Exit ${exit.mese}: ${exit.costi_uscita}`);
  });
  storageSummaries.forEach(storage => {
    console.log(`  Storage ${storage.mese}: ${storage.costo_storage}`);
  });
  
  const handleRefresh = () => {
    calculateSummaries();
  };
  
  return (
    <AppLayout>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
        }
      >
        <Text style={styles.sectionHeaderTitle}>
          {getMonthName(currentMonthKey)}
        </Text>
        <MonthlyTotalsCard
          entryCost={currentMonthEntryCost}
          exitCost={currentMonthExitCost}
          storageCost={currentMonthStorageCost}
          projectedStorageCost={currentMonthProjectedStorageCost}
          month={String(today.getMonth() + 1)}
          year={today.getFullYear()}
          monthName={getMonthName(currentMonthKey)}
          entrySummary={currentEntrySummary}
          exitSummary={currentExitSummary}
          storageDetails={currentStorageDetails}
        />

        {last3MonthsData.length > 0 && (
          <>
            <Text style={styles.sectionHeaderTitle}>Ultimi 3 Mesi</Text>
            {last3MonthsData.map((data, index) => (
              <MonthlyTotalsCard
                key={data.monthKey}
                entryCost={data.entryCost}
                exitCost={data.exitCost}
                storageCost={data.storageCost}
                month={data.monthKey.split('-')[1]}
                year={parseInt(data.monthKey.split('-')[0])}
                monthName={data.monthName}
                entrySummary={data.entrySummary}
                exitSummary={data.exitSummary}
                storageDetails={data.storageDetails}
              />
            ))}
          </>
        )}

        <Text style={styles.sectionHeaderTitle}>Riepilogo Totale Generale</Text>
        <View style={styles.summaryContainer}>
          <SummaryCard
            title="Costo Totale"
            amount={totalCost}
            subtitle="Tutte le operazioni"
            icon={<Database size={24} color={colors.primary} />}
          />
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <SummaryCard
                title="Costo Ingresso"
                amount={totalEntries}
                subtitle="Bancali in entrata"
                icon={<ArrowDownToLine size={20} color={colors.info} />}
                color={colors.info}
              />
            </View>
            <View style={styles.summaryCol}>
              <SummaryCard
                title="Costo Uscita"
                amount={totalExits}
                subtitle="Bancali in uscita"
                icon={<ArrowUpFromLine size={20} color={colors.warning} />}
                color={colors.warning}
              />
            </View>
          </View>
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <SummaryCard
                title="Costo Stoccaggio"
                amount={totalStorage}
                subtitle="Stoccaggio magazzino"
                icon={<Clock size={20} color={colors.secondary} />}
                color={colors.secondary}
              />
            </View>
            <View style={styles.summaryCol}>
              <SummaryCard
                title="Totale Bancali"
                amount={totalPallets}
                subtitle="Bancali equivalenti"
                icon={<Package size={20} color={colors.success} />}
                color={colors.success}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
    marginLeft: 8,
  },
  sectionHeaderTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 16,
    marginTop: 8,
  },
  summaryContainer: {
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: "row",
    marginHorizontal: -6,
    marginTop: 12,
  },
  summaryCol: {
    flex: 1,
    paddingHorizontal: 6,
  },
});
