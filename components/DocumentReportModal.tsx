import React from "react";
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from "react-native";
import { colors } from "@/constants/colors";
import { X, FileText, ArrowDownToLine, ArrowUpFromLine, Clock, Package } from "lucide-react-native";
import { formatCurrency, formatDate } from "@/utils/calculations";
import { createShadowStyle } from "@/utils/shadowStyles";
import { calculateEquivalence } from "@/utils/calculations";

interface DocumentReportModalProps {
  visible: boolean;
  onClose: () => void;
  report: {
    document: { numero_documento: string };
    rows: Array<{
      id: number;
      data_ingresso: string;
      numero_bancali_ingresso: number;
      tipologia_bancali_ingresso: string;
      note: string;
      uscite: { [key: string]: { data: string | null; bancali: number; giorni: number | null } };
    }>;
    totalIngresso: number;
    totalUscite: number;
    bancaliRimanenti: number;
    costiIngresso: number;
    costiUscita: number;
    costiStoccaggio: number;
    tutteUscite: Array<{ data: string; bancali: number; giorni: number | null }>;
  } | null;
}

export default function DocumentReportModal({
  visible,
  onClose,
  report,
}: DocumentReportModalProps) {
  if (!report) return null;

  // Calcola tipologie bancali
  const bancali100x120 = report.rows.reduce((sum, row) => {
    const is100x120 = row.tipologia_bancali_ingresso.toUpperCase() === '100X120';
    return sum + (is100x120 ? row.numero_bancali_ingresso : 0);
  }, 0);
  
  const bancali80x120 = report.rows.reduce((sum, row) => {
    const is100x120 = row.tipologia_bancali_ingresso.toUpperCase() === '100X120';
    return sum + (!is100x120 ? row.numero_bancali_ingresso : 0);
  }, 0);
  
  const bancaliCongelati = report.rows.reduce((sum, row) => {
    const isCongelato = row.note.toUpperCase().includes('CONGELATO');
    return sum + (isCongelato ? row.numero_bancali_ingresso : 0);
  }, 0);

  // Calcola equivalenza totale
  const equivalenzaTotale = bancali100x120 > 0 
    ? calculateEquivalence(bancali100x120) + bancali80x120
    : bancali80x120;

  // Calcola bancali rimanenti per tipologia
  const rimanenti100x120 = report.rows.reduce((sum, row) => {
    const is100x120 = row.tipologia_bancali_ingresso.toUpperCase() === '100X120';
    if (!is100x120) return sum;
    
    let usciti = 0;
    Object.values(row.uscite).forEach(uscita => {
      if (uscita.data && uscita.bancali > 0) {
        usciti += uscita.bancali;
      }
    });
    
    return sum + (row.numero_bancali_ingresso - usciti);
  }, 0);
  
  const rimanenti80x120 = report.rows.reduce((sum, row) => {
    const is100x120 = row.tipologia_bancali_ingresso.toUpperCase() === '100X120';
    if (is100x120) return sum;
    
    let usciti = 0;
    Object.values(row.uscite).forEach(uscita => {
      if (uscita.data && uscita.bancali > 0) {
        usciti += uscita.bancali;
      }
    });
    
    return sum + (row.numero_bancali_ingresso - usciti);
  }, 0);

  const totaleCosti = report.costiIngresso + report.costiUscita + report.costiStoccaggio;
  const tutteUscite = report.tutteUscite.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleContainer}>
              <FileText size={20} color={colors.primary} />
              <Text style={styles.modalTitle}>
                Report Documento: {report.document.numero_documento}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
            {/* Riepilogo Bancali */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Riepilogo Bancali</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Package size={16} color={colors.primary} />
                  <Text style={styles.summaryLabel}>Totale Ingresso:</Text>
                  <Text style={styles.summaryValue}>{report.totalIngresso} bancali</Text>
                </View>
                <View style={styles.summaryRow}>
                  <ArrowUpFromLine size={16} color={colors.warning} />
                  <Text style={styles.summaryLabel}>Totale Uscite:</Text>
                  <Text style={styles.summaryValue}>{report.totalUscite} bancali</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Package size={16} color={report.bancaliRimanenti > 0 ? colors.success : colors.darkGray} />
                  <Text style={styles.summaryLabel}>Bancali Rimanenti:</Text>
                  <Text style={[styles.summaryValue, report.bancaliRimanenti === 0 && styles.completedText]}>
                    {report.bancaliRimanenti} bancali {report.bancaliRimanenti === 0 && '(Tutti usciti)'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Dettagli Tipologia */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dettagli Tipologia</Text>
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bancali 100x120:</Text>
                  <Text style={styles.detailValue}>{bancali100x120} bancali</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bancali 80x120:</Text>
                  <Text style={styles.detailValue}>{bancali80x120} bancali</Text>
                </View>
                {bancaliCongelati > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Bancali Congelati:</Text>
                    <Text style={styles.detailValue}>{bancaliCongelati} bancali</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Equivalenza Totale:</Text>
                  <Text style={styles.detailValue}>{equivalenzaTotale} bancali equivalenti</Text>
                </View>
                {report.bancaliRimanenti > 0 && (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.subsectionTitle}>Bancali Rimanenti per Tipologia:</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>100x120 rimanenti:</Text>
                      <Text style={styles.detailValue}>{rimanenti100x120} bancali</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>80x120 rimanenti:</Text>
                      <Text style={styles.detailValue}>{rimanenti80x120} bancali</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Riepilogo Costi */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Riepilogo Costi</Text>
              <View style={styles.costCard}>
                <View style={styles.costRow}>
                  <ArrowDownToLine size={16} color={colors.info} />
                  <Text style={styles.costLabel}>Costo Ingresso:</Text>
                  <Text style={[styles.costValue, { color: colors.info }]}>
                    {formatCurrency(report.costiIngresso)}
                  </Text>
                </View>
                <View style={styles.costRow}>
                  <ArrowUpFromLine size={16} color={colors.warning} />
                  <Text style={styles.costLabel}>Costo Uscite:</Text>
                  <Text style={[styles.costValue, { color: colors.warning }]}>
                    {formatCurrency(report.costiUscita)}
                  </Text>
                </View>
                <View style={styles.costRow}>
                  <Clock size={16} color={colors.secondary} />
                  <Text style={styles.costLabel}>Costo Stoccaggio:</Text>
                  <Text style={[styles.costValue, { color: colors.secondary }]}>
                    {formatCurrency(report.costiStoccaggio)}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.costRow}>
                  <Text style={styles.totalCostLabel}>Costo Totale:</Text>
                  <Text style={styles.totalCostValue}>
                    {formatCurrency(totaleCosti)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Dettagli Ingressi */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dettagli Ingressi</Text>
              {report.rows.map((row, index) => {
                const is100x120 = row.tipologia_bancali_ingresso.toUpperCase() === '100X120';
                const isCongelato = row.note.toUpperCase().includes('CONGELATO');
                
                return (
                  <View key={`row-${row.id}-${index}-${row.data_ingresso}`} style={styles.detailCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Data Ingresso:</Text>
                      <Text style={styles.detailValue}>{formatDate(row.data_ingresso)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Bancali:</Text>
                      <Text style={styles.detailValue}>
                        {row.numero_bancali_ingresso} {is100x120 ? '100x120' : '80x120'}
                        {isCongelato && ' (Congelato)'}
                      </Text>
                    </View>
                    {row.note && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Note:</Text>
                        <Text style={styles.detailValue}>{row.note}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Dettagli Uscite */}
            {tutteUscite && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Dettagli Uscite ({report.tutteUscite.length})</Text>
                {report.tutteUscite.map((uscita, index) => (
                  <View key={`uscita-${uscita.data}-${uscita.bancali}-${index}`} style={styles.detailCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Data Uscita:</Text>
                      <Text style={styles.detailValue}>{formatDate(uscita.data)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Bancali Usciti:</Text>
                      <Text style={styles.detailValue}>{uscita.bancali} bancali</Text>
                    </View>
                    {uscita.giorni !== null && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Giorni in Stoccaggio:</Text>
                        <Text style={styles.detailValue}>{uscita.giorni} giorni</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const shadowStyle = createShadowStyle("#000", { width: 0, height: 4 }, 0.2, 8, 4);

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    ...shadowStyle,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.darkGray,
    marginTop: 8,
    marginBottom: 8,
  },
  summaryCard: {
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.darkGray,
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  completedText: {
    color: colors.success,
    fontStyle: "italic",
  },
  detailCard: {
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.darkGray,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
    textAlign: "right",
  },
  costCard: {
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  costLabel: {
    fontSize: 14,
    color: colors.darkGray,
    flex: 1,
  },
  costValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  totalCostLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
  totalCostValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
});

