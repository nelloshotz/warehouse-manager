import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, TextInput } from "react-native";
import { useWarehouseStore } from "@/store/warehouseStore";
import { useSettingsStore } from "@/store/settingsStore";
import { colors } from "@/constants/colors";
import { Clock, ChevronDown, Search } from "lucide-react-native";
import DataTable from "@/components/DataTable";
import StorageChart from "@/components/StorageChart";
import { formatCurrency, formatMonth } from "@/utils/calculations";
import StorageDetailView from "@/components/StorageDetailView";
import AppLayout from "@/components/AppLayout";
import DocumentReportModal from "@/components/DocumentReportModal";

export default function StorageScreen() {
  const { 
    storageSummaries, 
    calculateSummaries, 
    isLoading,
    getDocumentReport
  } = useWarehouseStore();
  const { costSettings } = useSettingsStore();
  const [sortedStorage, setSortedStorage] = useState([...storageSummaries]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [documentReport, setDocumentReport] = useState<any>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  
  useEffect(() => {
    calculateSummaries();
  }, []);
  
  useEffect(() => {
    const sorted = [...storageSummaries].sort((a, b) => 
      b.mese.localeCompare(a.mese)
    );
    setSortedStorage(sorted);
  }, [storageSummaries]);
  
  const totalCost = storageSummaries.reduce((sum, storage) => sum + storage.costo_storage, 0);
  const averageStock = storageSummaries.length > 0 
    ? storageSummaries.reduce((sum, storage) => sum + storage.stock_medio, 0) / storageSummaries.length
    : 0;
  
  const columns = [
    {
      key: "mese",
      title: "Mese",
      render: (value: string) => (
        <TouchableOpacity 
          onPress={() => handleMonthSelect(value)}
          style={styles.monthLink}
        >
          <Text style={styles.monthLinkText}>{formatMonth(value)}</Text>
          <ChevronDown size={16} color={colors.primary} />
        </TouchableOpacity>
      ),
    },
    {
      key: "stock_medio",
      title: "Stock Medio",
      render: (value: number) => <Text>{Math.round(value)}</Text>,
    },
    {
      key: "costo_storage",
      title: "Costo Stoccaggio",
      render: (value: number) => <Text style={styles.costText}>{formatCurrency(value)}</Text>,
    },
  ];
  
  const handleRefresh = () => {
    calculateSummaries();
  };
  
  const handleMonthSelect = (month: string) => {
    setSelectedMonth(month);
    setDetailsVisible(true);
  };
  
  const closeDetails = () => {
    setDetailsVisible(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    const report = await getDocumentReport(searchQuery.trim());
    if (report) {
      if (report.rows.length === 0) {
        alert(`Documento "${searchQuery.trim()}" trovato ma non ha righe associate. Il documento potrebbe essere vuoto o non ancora processato.`);
      }
      setDocumentReport(report);
      setReportModalVisible(true);
    } else {
      alert(`Documento "${searchQuery.trim()}" non trovato. Verifica che il numero documento sia corretto.`);
    }
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
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search size={20} color={colors.darkGray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cerca numero documento..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Cerca</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{Math.round(averageStock)}</Text>
            <Text style={styles.statLabel}>Stock Medio</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(totalCost)}</Text>
            <Text style={styles.statLabel}>Costo Totale</Text>
          </View>
        </View>
        
        <StorageChart data={storageSummaries} />
        
        <View style={styles.tableContainer}>
          <Text style={styles.tableTitle}>Stoccaggio Mensile</Text>
          <Text style={styles.tableSubtitle}>Clicca su un mese per vedere i calcoli dettagliati</Text>
          <DataTable 
            data={sortedStorage} 
            columns={columns} 
            emptyMessage="Nessun dato di stoccaggio disponibile. Carica un file per vedere i costi di stoccaggio."
          />
        </View>
      </ScrollView>
      
      {detailsVisible && selectedMonth && (
        <StorageDetailView 
          month={selectedMonth}
          visible={detailsVisible}
          onClose={closeDetails}
        />
      )}

      {documentReport && (
        <DocumentReportModal
          visible={reportModalVisible}
          onClose={() => {
            setReportModalVisible(false);
            setDocumentReport(null);
            setSearchQuery("");
          }}
          report={documentReport}
        />
      )}
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
  searchContainer: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 12,
  },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  searchButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -8,
    marginBottom: 24,
  },
  statCard: {
    width: "50%",
    paddingHorizontal: 8,
    marginBottom: 16,
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: colors.darkGray,
  },
  tableContainer: {
    marginBottom: 24,
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  tableSubtitle: {
    fontSize: 14,
    color: colors.darkGray,
    marginBottom: 12,
  },
  costText: {
    color: colors.secondary,
    fontWeight: "500",
  },
  monthLink: {
    flexDirection: "row",
    alignItems: "center",
  },
  monthLinkText: {
    color: colors.primary,
    fontWeight: "500",
    marginRight: 4,
  },
});
