import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";
import { formatCurrency, formatMonth } from "@/utils/calculations";
import { createShadowStyle } from "@/utils/shadowStyles";

interface StorageChartProps {
  data: Array<{
    mese: string;
    stock_medio: number;
    costo_storage: number;
  }>;
}

export default function StorageChart({ data }: StorageChartProps) {
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nessun dato di stoccaggio disponibile</Text>
      </View>
    );
  }

  // Ordina i dati per mese
  const sortedData = [...data].sort((a, b) => a.mese.localeCompare(b.mese));
  
  // Trova il valore massimo di stock per il ridimensionamento
  const maxStock = Math.max(...sortedData.map(item => item.stock_medio));
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Panoramica Stoccaggio Mensile</Text>
      
      <View style={styles.chartContainer}>
        {sortedData.map((item, index) => {
          const barHeight = (item.stock_medio / maxStock) * 150;
          return (
            <View key={index} style={styles.barContainer}>
              <Text style={styles.barValue}>{Math.round(item.stock_medio)}</Text>
              <View style={styles.barWrapper}>
                <View 
                  style={[
                    styles.bar, 
                    { height: barHeight > 0 ? barHeight : 2 }
                  ]} 
                />
              </View>
              <Text style={styles.barLabel}>{formatMonth(item.mese).substring(0, 3)}</Text>
              <Text style={styles.barCost}>{formatCurrency(item.costo_storage)}</Text>
            </View>
          );
        })}
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
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 200,
  },
  barContainer: {
    alignItems: "center",
    flex: 1,
  },
  barValue: {
    fontSize: 10,
    color: colors.darkGray,
    marginBottom: 4,
  },
  barWrapper: {
    width: "70%",
    alignItems: "center",
    justifyContent: "flex-end",
    height: 150,
  },
  bar: {
    width: "100%",
    backgroundColor: colors.secondary,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    color: colors.darkGray,
    marginTop: 4,
  },
  barCost: {
    fontSize: 9,
    color: colors.darkGray,
    marginTop: 2,
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