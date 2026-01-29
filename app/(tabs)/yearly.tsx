import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useWarehouseStore } from "@/store/warehouseStore";
import { colors } from "@/constants/colors";
import { Calendar, ChevronDown, ChevronUp } from "lucide-react-native";
import YearlyTotalsChart from "@/components/YearlyTotalsChart";
import { formatCurrency } from "@/utils/calculations";
import AppLayout from "@/components/AppLayout";

export default function YearlyReportScreen() {
  const { 
    entrySummaries, 
    exitSummaries, 
    storageSummaries, 
    calculateSummaries, 
    isLoading 
  } = useWarehouseStore();
  
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showYearPicker, setShowYearPicker] = useState(false);
  
  const availableYears = [...new Set([
    ...entrySummaries.map(entry => parseInt(entry.mese_ingresso.split("-")[0])),
    ...exitSummaries.map(exit => parseInt(exit.mese.split("-")[0])),
    ...storageSummaries.map(storage => parseInt(storage.mese.split("-")[0])),
  ])].sort((a, b) => b - a);
  
  if (availableYears.length === 0) {
    availableYears.push(currentYear);
  }
  
  useEffect(() => {
    calculateSummaries();
  }, []);
  
  const prepareYearlyData = () => {
    const monthsInYear = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      return `${selectedYear}-${month.toString().padStart(2, '0')}`;
    });
    
    return monthsInYear.map(monthKey => {
      const entryData = entrySummaries.find(entry => entry.mese_ingresso === monthKey);
      const exitData = exitSummaries.find(exit => exit.mese === monthKey);
      const storageData = storageSummaries.find(storage => storage.mese === monthKey);
      
      return {
        month: monthKey,
        entryCost: entryData ? entryData.costo_ingresso : 0,
        exitCost: exitData ? exitData.costi_uscita : 0,
        storageCost: storageData ? storageData.costo_storage : 0,
      };
    });
  };
  
  const yearlyData = prepareYearlyData();
  
  const yearlyTotals = yearlyData.reduce(
    (acc, item) => {
      acc.entryCost += item.entryCost;
      acc.exitCost += item.exitCost;
      acc.storageCost += item.storageCost;
      acc.totalCost += item.entryCost + item.exitCost + item.storageCost;
      return acc;
    },
    { entryCost: 0, exitCost: 0, storageCost: 0, totalCost: 0 }
  );
  
  const handleRefresh = () => {
    calculateSummaries();
  };
  
  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    setShowYearPicker(false);
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
        <View style={styles.yearPickerContainer}>
          <TouchableOpacity 
            style={styles.yearPickerButton}
            onPress={() => setShowYearPicker(!showYearPicker)}
          >
            <Calendar size={16} color={colors.primary} style={styles.yearPickerIcon} />
            <Text style={styles.yearPickerText}>{selectedYear}</Text>
            {showYearPicker ? (
              <ChevronUp size={16} color={colors.darkGray} />
            ) : (
              <ChevronDown size={16} color={colors.darkGray} />
            )}
          </TouchableOpacity>
          
          {showYearPicker && (
            <View style={styles.yearsList}>
              {availableYears.map(year => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.yearItem,
                    selectedYear === year && styles.selectedYearItem,
                  ]}
                  onPress={() => handleYearSelect(year)}
                >
                  <Text
                    style={[
                      styles.yearItemText,
                      selectedYear === year && styles.selectedYearItemText,
                    ]}
                  >
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Riepilogo Annuale - {selectedYear}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Costo Totale:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(yearlyTotals.totalCost)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Costo Ingresso:</Text>
              <Text style={[styles.detailValue, { color: colors.info }]}>
                {formatCurrency(yearlyTotals.entryCost)}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Costo Uscita:</Text>
              <Text style={[styles.detailValue, { color: colors.warning }]}>
                {formatCurrency(yearlyTotals.exitCost)}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Costo Stoccaggio:</Text>
              <Text style={[styles.detailValue, { color: colors.secondary }]}>
                {formatCurrency(yearlyTotals.storageCost)}
              </Text>
            </View>
          </View>
        </View>
        
        <YearlyTotalsChart data={yearlyData} year={selectedYear} />
        
        <View style={styles.quarterlySection}>
          <Text style={styles.sectionTitle}>Dettaglio Trimestrale</Text>
          
          {[1, 2, 3, 4].map(quarter => {
            const startMonth = (quarter - 1) * 3;
            const quarterData = yearlyData.slice(startMonth, startMonth + 3);
            const quarterTotals = quarterData.reduce(
              (acc, item) => {
                acc.entryCost += item.entryCost;
                acc.exitCost += item.exitCost;
                acc.storageCost += item.storageCost;
                acc.totalCost += item.entryCost + item.exitCost + item.storageCost;
                return acc;
              },
              { entryCost: 0, exitCost: 0, storageCost: 0, totalCost: 0 }
            );
            
            return (
              <View key={quarter} style={styles.quarterCard}>
                <Text style={styles.quarterTitle}>Q{quarter} {selectedYear}</Text>
                <View style={styles.quarterRow}>
                  <View style={styles.quarterItem}>
                    <Text style={styles.quarterItemValue}>{formatCurrency(quarterTotals.entryCost)}</Text>
                    <Text style={styles.quarterItemLabel}>Ingresso</Text>
                  </View>
                  <View style={styles.quarterItem}>
                    <Text style={styles.quarterItemValue}>{formatCurrency(quarterTotals.exitCost)}</Text>
                    <Text style={styles.quarterItemLabel}>Uscita</Text>
                  </View>
                  <View style={styles.quarterItem}>
                    <Text style={styles.quarterItemValue}>{formatCurrency(quarterTotals.storageCost)}</Text>
                    <Text style={styles.quarterItemLabel}>Stoccaggio</Text>
                  </View>
                </View>
                <View style={styles.quarterTotal}>
                  <Text style={styles.quarterTotalLabel}>Totale:</Text>
                  <Text style={styles.quarterTotalValue}>{formatCurrency(quarterTotals.totalCost)}</Text>
                </View>
              </View>
            );
          })}
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
  yearPickerContainer: {
    marginBottom: 16,
    position: "relative",
    zIndex: 10,
  },
  yearPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  yearPickerIcon: {
    marginRight: 8,
  },
  yearPickerText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
    flex: 1,
  },
  yearsList: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 200,
  },
  yearItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedYearItem: {
    backgroundColor: colors.lightGray,
  },
  yearItemText: {
    fontSize: 16,
    color: colors.text,
  },
  selectedYearItemText: {
    color: colors.primary,
    fontWeight: "600",
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  detailsContainer: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 14,
    color: colors.darkGray,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "500",
  },
  quarterlySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  quarterCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  quarterTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  quarterRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  quarterItem: {
    flex: 1,
    alignItems: "center",
  },
  quarterItemValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  quarterItemLabel: {
    fontSize: 12,
    color: colors.darkGray,
  },
  quarterTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quarterTotalLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  quarterTotalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
});
