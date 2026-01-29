import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TextInput, TouchableOpacity } from "react-native";
import { useWarehouseStore } from "@/store/warehouseStore";
import { colors } from "@/constants/colors";
import { ArrowUpFromLine, Search } from "lucide-react-native";
import DataTable from "@/components/DataTable";
import { formatCurrency, formatMonth } from "@/utils/calculations";
import { DocumentRow, Document } from "@/types/warehouse";
import AppLayout from "@/components/AppLayout";
import MonthDetailsModal from "@/components/MonthDetailsModal";
import DocumentReportModal from "@/components/DocumentReportModal";

export default function ExitsScreen() {
  const { 
    exitSummaries, 
    calculateSummaries, 
    isLoading,
    getDocumentRowsByMonth,
    getDocumentReport,
    documents
  } = useWarehouseStore();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [documentReport, setDocumentReport] = useState<any>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [monthDocumentRows, setMonthDocumentRows] = useState<DocumentRow[]>([]);
  const [monthDocuments, setMonthDocuments] = useState<Document[]>([]);
  
  useEffect(() => {
    calculateSummaries();
  }, []);
  
  // Carica i dati del mese quando viene selezionato
  useEffect(() => {
    if (selectedMonth) {
      const loadMonthData = async () => {
        const rows = await getDocumentRowsByMonth(selectedMonth, 'exit');
        const jsonData = await useWarehouseStore.getState().loadDataFromJSON();
        const docs = jsonData?.documents || documents;
        setMonthDocumentRows(rows);
        setMonthDocuments(docs);
      };
      loadMonthData();
    }
  }, [selectedMonth]);
  
  const totalCost = exitSummaries.reduce((sum, exit) => sum + exit.costi_uscita, 0);
  const totalPallets100x120 = exitSummaries.reduce((sum, exit) => sum + exit.tot_bancali_100x120, 0);
  const totalPallets80x120 = exitSummaries.reduce((sum, exit) => sum + exit.tot_bancali_80x120, 0);
  const totalEquivalence = exitSummaries.reduce((sum, exit) => sum + exit.equivalenza_100x120, 0);
  const totalPallets = exitSummaries.reduce((sum, exit) => sum + exit.totale_bancali_uscita, 0);
  
  const handleRowPress = (item: any) => {
    setSelectedMonth(item.mese);
    setModalVisible(true);
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
  
  const columns = [
    {
      key: "mese",
      title: "Mese",
      render: (value: string) => <Text>{formatMonth(value)}</Text>,
      sortable: true,
    },
    {
      key: "tot_bancali_100x120",
      title: "Bancali 100x120",
      render: (value: number) => <Text>{value}</Text>,
      sortable: true,
    },
    {
      key: "equivalenza_100x120",
      title: "Equivalenza 100x120",
      render: (value: number) => <Text>{value}</Text>,
      sortable: true,
    },
    {
      key: "tot_bancali_80x120",
      title: "Bancali 80x120",
      render: (value: number) => <Text>{value}</Text>,
      sortable: true,
    },
    {
      key: "totale_bancali_uscita",
      title: "Totale Bancali",
      render: (value: number) => <Text>{value}</Text>,
      sortable: true,
    },
    {
      key: "costi_uscita",
      title: "Costo",
      render: (value: number) => <Text style={styles.costText}>{formatCurrency(value)}</Text>,
      sortable: true,
    },
  ];
  
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
            <Text style={styles.statValue}>{totalPallets100x120}</Text>
            <Text style={styles.statLabel}>Bancali 100x120</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalEquivalence}</Text>
            <Text style={styles.statLabel}>Equivalenza</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalPallets80x120}</Text>
            <Text style={styles.statLabel}>Bancali 80x120</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(totalCost)}</Text>
            <Text style={styles.statLabel}>Costo Totale</Text>
          </View>
        </View>
        
        <View style={styles.tableContainer}>
          <Text style={styles.tableTitle}>Uscite Mensili</Text>
          <DataTable 
            data={exitSummaries} 
            columns={columns} 
            emptyMessage="Nessun dato di uscita disponibile. Carica un file per vedere le uscite."
            onRowPress={handleRowPress}
          />
        </View>
      </ScrollView>

      {selectedMonth && (
        <MonthDetailsModal
          visible={modalVisible}
          onClose={() => {
            setModalVisible(false);
            setSelectedMonth(null);
          }}
          monthKey={selectedMonth}
          monthName={formatMonth(selectedMonth)}
          type="exit"
          documentRows={monthDocumentRows}
          documents={monthDocuments}
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
    marginBottom: 12,
  },
  costText: {
    color: colors.warning,
    fontWeight: "500",
  },
});
