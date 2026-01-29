import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { colors } from "@/constants/colors";
import { formatCurrency } from "@/utils/calculations";
import { createShadowStyle } from "@/utils/shadowStyles";

interface YearlyData {
  month: string;
  entryCost: number;
  exitCost: number;
  storageCost: number;
}

interface YearlyTotalsChartProps {
  data: YearlyData[];
  year: number;
}

export default function YearlyTotalsChart({ data, year }: YearlyTotalsChartProps) {
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nessun dato disponibile per {year}</Text>
      </View>
    );
  }

  // Trova il valore massimo per il ridimensionamento
  const maxValue = Math.max(
    ...data.map(item => Math.max(item.entryCost, item.exitCost, item.storageCost))
  );
  
  // Nomi dei mesi
  const monthNames = [
    "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
    "Lug", "Ago", "Set", "Ott", "Nov", "Dic"
  ];
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dettaglio Costi Annuali - {year}</Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chartContainer}>
          {data.map((item, index) => {
            const monthNumber = parseInt(item.month.split("-")[1]);
            const monthName = monthNames[monthNumber - 1];
            
            const totalCost = item.entryCost + item.exitCost + item.storageCost;
            const entryHeight = (item.entryCost / maxValue) * 180;
            const exitHeight = (item.exitCost / maxValue) * 180;
            const storageHeight = (item.storageCost / maxValue) * 180;
            
            return (
              <View key={index} style={styles.barGroup}>
                <Text style={styles.barValue}>{formatCurrency(totalCost)}</Text>
                <View style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    <View 
                      style={[
                        styles.bar, 
                        styles.entryBar,
                        { height: entryHeight > 0 ? entryHeight : 0 }
                      ]} 
                    />
                    <View 
                      style={[
                        styles.bar, 
                        styles.exitBar,
                        { height: exitHeight > 0 ? exitHeight : 0 }
                      ]} 
                    />
                    <View 
                      style={[
                        styles.bar, 
                        styles.storageBar,
                        { height: storageHeight > 0 ? storageHeight : 0 }
                      ]} 
                    />
                  </View>
                </View>
                <Text style={styles.barLabel}>{monthName}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: colors.info }]} />
          <Text style={styles.legendText}>Ingresso</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: colors.warning }]} />
          <Text style={styles.legendText}>Uscita</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: colors.secondary }]} />
          <Text style={styles.legendText}>Stoccaggio</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...createShadowStyle("#000", { width: 0, height: 2 }, 0.1, 4, 2),
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: "row",
    paddingBottom: 16,
    paddingTop: 8,
    minWidth: "100%",
    minHeight: 250,
  },
  barGroup: {
    alignItems: "center",
    width: 60,
    marginRight: 12,
    paddingVertical: 8,
  },
  barValue: {
    fontSize: 9,
    color: colors.darkGray,
    marginBottom: 12,
    textAlign: "center",
    minHeight: 24,
    maxWidth: 55,
  },
  barContainer: {
    height: 180,
    justifyContent: "flex-end",
    width: "100%",
  },
  barWrapper: {
    width: 30,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    marginBottom: 1,
  },
  entryBar: {
    backgroundColor: colors.info,
  },
  exitBar: {
    backgroundColor: colors.warning,
  },
  storageBar: {
    backgroundColor: colors.secondary,
  },
  barLabel: {
    fontSize: 12,
    color: colors.darkGray,
    marginTop: 12,
    fontWeight: "500",
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
    color: colors.darkGray,
  },
  emptyContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyText: {
    color: colors.darkGray,
    fontSize: 16,
  },
});