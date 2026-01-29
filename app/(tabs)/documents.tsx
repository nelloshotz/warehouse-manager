import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useWarehouseStore } from "@/store/warehouseStore";
import { colors } from "@/constants/colors";
import { FileText, ChevronDown, ChevronUp } from "lucide-react-native";
import MonthYearPicker from "@/components/MonthYearPicker";
import { formatDate } from "@/utils/calculations";
import AppLayout from "@/components/AppLayout";

export default function DocumentsScreen() {
  const { documents, documentRows, getDocumentsByMonth, calculateSummaries, isLoading } = useWarehouseStore();
  
  const currentDate = new Date();
  const [selectedDate, setSelectedDate] = useState({
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
  });
  
  const [expandedDocuments, setExpandedDocuments] = useState<{[key: number]: boolean}>({});
  
  useEffect(() => {
    calculateSummaries();
  }, []);
  
  const monthKey = `${selectedDate.year}-${String(selectedDate.month).padStart(2, '0')}`;
  const [documentsForMonth, setDocumentsForMonth] = useState<Document[]>([]);
  
  useEffect(() => {
    const loadDocuments = async () => {
      const docs = await getDocumentsByMonth(monthKey);
      setDocumentsForMonth(docs);
    };
    loadDocuments();
  }, [monthKey]);
  
  const getRowsForDocument = (documentId: number) => {
    return documentRows.filter(row => row.documento_id === documentId);
  };
  
  const toggleDocument = (documentId: number) => {
    setExpandedDocuments(prev => ({
      ...prev,
      [documentId]: !prev[documentId]
    }));
  };
  
  const handleRefresh = () => {
    calculateSummaries();
  };
  
  const handleDateChange = (date: { month: number; year: number }) => {
    setSelectedDate(date);
    setExpandedDocuments({});
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
        
        <View style={styles.documentsContainer}>
          <Text style={styles.sectionTitle}>
            Documenti per {new Date(selectedDate.year, selectedDate.month - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
          </Text>
          
          {documentsForMonth.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nessun documento trovato per questo mese</Text>
            </View>
          ) : (
            documentsForMonth.map((document) => (
              <View key={document.id} style={styles.documentContainer}>
                <TouchableOpacity 
                  style={styles.documentHeader}
                  onPress={() => toggleDocument(document.id)}
                >
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentNumber}>{document.numero_documento}</Text>
                    <Text style={styles.documentCount}>
                      {getRowsForDocument(document.id).length} voci
                    </Text>
                  </View>
                  {expandedDocuments[document.id] ? (
                    <ChevronUp size={20} color={colors.darkGray} />
                  ) : (
                    <ChevronDown size={20} color={colors.darkGray} />
                  )}
                </TouchableOpacity>
                
                {expandedDocuments[document.id] && (
                  <View style={styles.rowsContainer}>
                    {getRowsForDocument(document.id).map((row, index) => (
                      <View key={index} style={styles.rowItem}>
                        <View style={styles.rowHeader}>
                          <Text style={styles.rowDate}>
                            Data Ingresso: {formatDate(row.data_ingresso)}
                          </Text>
                          <Text style={styles.rowType}>
                            Tipo: {row.tipologia_bancali_ingresso}
                          </Text>
                        </View>
                        
                        <View style={styles.rowDetails}>
                          <Text style={styles.rowPallets}>
                            Bancali: {row.numero_bancali_ingresso}
                          </Text>
                          {row.note && (
                            <Text style={styles.rowNotes}>
                              Note: {row.note}
                            </Text>
                          )}
                        </View>
                        
                        {Object.entries(row.uscite).length > 0 && (
                          <View style={styles.exitsContainer}>
                            <Text style={styles.exitsTitle}>Uscite:</Text>
                            {Object.entries(row.uscite).map(([key, exit], exitIndex) => (
                              exit.data && (
                                <View key={exitIndex} style={styles.exitItem}>
                                  <Text style={styles.exitDate}>
                                    {formatDate(exit.data)}
                                  </Text>
                                  <Text style={styles.exitPallets}>
                                    {exit.bancali} bancali
                                  </Text>
                                  {exit.giorni && (
                                    <Text style={styles.exitDays}>
                                      {exit.giorni} giorni
                                    </Text>
                                  )}
                                </View>
                              )
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
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
  documentsContainer: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 16,
  },
  emptyContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.darkGray,
    fontSize: 16,
  },
  documentContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  documentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  documentInfo: {
    flex: 1,
  },
  documentNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  documentCount: {
    fontSize: 12,
    color: colors.darkGray,
  },
  rowsContainer: {
    padding: 16,
    paddingTop: 0,
  },
  rowItem: {
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  rowDate: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  rowType: {
    fontSize: 14,
    color: colors.darkGray,
  },
  rowDetails: {
    marginBottom: 8,
  },
  rowPallets: {
    fontSize: 14,
    color: colors.text,
  },
  rowNotes: {
    fontSize: 14,
    color: colors.text,
    fontStyle: "italic",
    marginTop: 4,
  },
  exitsContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  exitsTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
    marginBottom: 8,
  },
  exitItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  exitDate: {
    fontSize: 13,
    color: colors.text,
    marginRight: 12,
  },
  exitPallets: {
    fontSize: 13,
    color: colors.text,
    marginRight: 12,
  },
  exitDays: {
    fontSize: 13,
    color: colors.darkGray,
  },
});
