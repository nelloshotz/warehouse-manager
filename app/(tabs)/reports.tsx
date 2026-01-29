import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useWarehouseStore } from "@/store/warehouseStore";
import { colors } from "@/constants/colors";
import { BarChart2 } from "lucide-react-native";
import MonthYearPicker from "@/components/MonthYearPicker";
import MonthlyTotalsCard from "@/components/MonthlyTotalsCard";
import { formatMonth } from "@/utils/calculations";
import AppLayout from "@/components/AppLayout";

export default function ReportsScreen() {
  const { 
    entrySummaries, 
    exitSummaries, 
    storageSummaries, 
    calculateSummaries, 
    isLoading,
    calculateProjectedStorage,
    getStorageDetailsByMonth
  } = useWarehouseStore();
  
  const currentDate = new Date();
  const [selectedDate, setSelectedDate] = useState({
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
  });
  
  useEffect(() => {
    calculateSummaries();
  }, []);
  
  const monthKey = `${selectedDate.year}-${String(selectedDate.month).padStart(2, '0')}`;
  
  const entriesForMonth = entrySummaries.find(entry => entry.mese_ingresso === monthKey) || {
    mese_ingresso: monthKey,
    numero_bancali_ingresso_100x120: 0,
    equivalenza_100x120: 0,
    numero_bancali_ingresso_80x120: 0,
    totale_bancali: 0,
    costo_ingresso: 0,
    numero_bancali_congelato: 0,
    equivalenza_bancali_congelato: 0,
  };
  
  const exitsForMonth = exitSummaries.find(exit => exit.mese === monthKey) || {
    mese: monthKey,
    tot_bancali_100x120: 0,
    equivalenza_100x120: 0,
    tot_bancali_80x120: 0,
    costi_uscita: 0,
    totale_bancali_uscita: 0,
    tot_bancali_congelato: 0,
    equivalenza_congelato: 0,
  };
  
  const storageForMonth = storageSummaries.find(storage => storage.mese === monthKey) || {
    mese: monthKey,
    stock_medio: 0,
    giorni_totali: 0,
    costo_storage: 0,
  };
  
  const [storageDetails, setStorageDetails] = useState({ pallets100x120: 0, pallets80x120: 0, equivalentPallets: 0, totalPallets: 0 });
  
  useEffect(() => {
    const loadDetails = async () => {
      const details = await getStorageDetailsByMonth(monthKey);
      setStorageDetails(details);
    };
    loadDetails();
  }, [monthKey]);
  
  const isCurrentMonth = currentDate.getMonth() + 1 === selectedDate.month && 
                         currentDate.getFullYear() === selectedDate.year;
  
  const projectedStorageCost = isCurrentMonth 
    ? calculateProjectedStorage(storageForMonth.stock_medio, monthKey)
    : undefined;
  
  const handleRefresh = () => {
    calculateSummaries();
  };
  
  const handleDateChange = (date: { month: number; year: number }) => {
    setSelectedDate(date);
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
        <MonthYearPicker 
          selectedDate={selectedDate}
          onSelect={handleDateChange}
        />
        
        <MonthlyTotalsCard 
          entryCost={entriesForMonth.costo_ingresso}
          exitCost={exitsForMonth.costi_uscita}
          storageCost={storageForMonth.costo_storage}
          projectedStorageCost={projectedStorageCost}
          month={String(selectedDate.month)}
          year={selectedDate.year}
        />
        
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <BarChart2 size={20} color={colors.text} />
            <Text style={styles.sectionTitle}>Dettaglio Mensile</Text>
          </View>
          
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ingressi</Text>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{entriesForMonth.numero_bancali_ingresso_100x120}</Text>
                <Text style={styles.statLabel}>Bancali 100x120</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{entriesForMonth.equivalenza_100x120}</Text>
                <Text style={styles.statLabel}>Equivalenza</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{entriesForMonth.numero_bancali_ingresso_80x120}</Text>
                <Text style={styles.statLabel}>Bancali 80x120</Text>
              </View>
            </View>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{entriesForMonth.numero_bancali_congelato}</Text>
                <Text style={styles.statLabel}>Bancali Congelati</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{entriesForMonth.equivalenza_bancali_congelato}</Text>
                <Text style={styles.statLabel}>Equiv. Congelati</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{entriesForMonth.totale_bancali}</Text>
                <Text style={styles.statLabel}>Totale Bancali</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Uscite</Text>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{exitsForMonth.tot_bancali_100x120}</Text>
                <Text style={styles.statLabel}>Bancali 100x120</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{exitsForMonth.equivalenza_100x120}</Text>
                <Text style={styles.statLabel}>Equivalenza</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{exitsForMonth.tot_bancali_80x120}</Text>
                <Text style={styles.statLabel}>Bancali 80x120</Text>
              </View>
            </View>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{exitsForMonth.tot_bancali_congelato}</Text>
                <Text style={styles.statLabel}>Bancali Congelati</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{exitsForMonth.equivalenza_congelato}</Text>
                <Text style={styles.statLabel}>Equiv. Congelati</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{exitsForMonth.totale_bancali_uscita}</Text>
                <Text style={styles.statLabel}>Totale Bancali</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Stoccaggio</Text>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{storageDetails.pallets100x120}</Text>
                <Text style={styles.statLabel}>Bancali 100x120</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{storageDetails.equivalentPallets}</Text>
                <Text style={styles.statLabel}>Bancali Equivalenti</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{storageDetails.pallets80x120}</Text>
                <Text style={styles.statLabel}>Bancali 80x120</Text>
              </View>
            </View>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{storageDetails.totalPallets}</Text>
                <Text style={styles.statLabel}>Totale Bancali</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{Math.round(storageForMonth.stock_medio)}</Text>
                <Text style={styles.statLabel}>Stock Medio</Text>
              </View>
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
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginLeft: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.darkGray,
    textAlign: "center",
  },
});
