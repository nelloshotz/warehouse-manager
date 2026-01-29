import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors } from "@/constants/colors";
import { formatCurrency } from "@/utils/calculations";
import { ArrowDownToLine, ArrowUpFromLine, Clock, Database, ChevronDown, ChevronUp } from "lucide-react-native";
import { createShadowStyle } from "@/utils/shadowStyles";
import { EntrySummary, ExitSummary } from "@/types/warehouse";

interface StorageDetails {
  pallets100x120: number;
  equivalentPallets: number;
  pallets80x120: number;
  totalPallets: number;
  palletsCongelato100x120: number;
  palletsCongelato80x120: number;
  totalPalletsCongelato: number;
  equivalentPalletsCongelato: number;
}

interface MonthlyTotalsCardProps {
  entryCost: number;
  exitCost: number;
  storageCost: number;
  projectedStorageCost?: number;
  month: string;
  year: number;
  monthName?: string;
  entrySummary?: EntrySummary;
  exitSummary?: ExitSummary;
  storageDetails?: StorageDetails;
}

export default function MonthlyTotalsCard({
  entryCost,
  exitCost,
  storageCost,
  projectedStorageCost,
  month,
  year,
  monthName,
  entrySummary,
  exitSummary,
  storageDetails,
}: MonthlyTotalsCardProps) {
  const [expandedEntry, setExpandedEntry] = useState(false);
  const [expandedExit, setExpandedExit] = useState(false);
  const [expandedStorage, setExpandedStorage] = useState(false);
  
  const totalCost = entryCost + exitCost + storageCost;
  const isCurrentMonth = new Date().getMonth() + 1 === parseInt(month) && 
                         new Date().getFullYear() === year;
  
  // Usa il nome del mese se fornito, altrimenti genera da month/year
  const displayMonthName = monthName || (() => {
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  })();
  
  // Calcola i bancali totali per ingresso (normali + congelati)
  const totalEntryPallets = entrySummary 
    ? (entrySummary.numero_bancali_ingresso_100x120 + entrySummary.numero_bancali_ingresso_80x120 + entrySummary.numero_bancali_congelato)
    : 0;
  
  // Calcola i bancali normali per ingresso (senza congelati)
  const normalEntryPallets = entrySummary
    ? (entrySummary.numero_bancali_ingresso_100x120 + entrySummary.numero_bancali_ingresso_80x120)
    : 0;
  
  // Calcola i bancali totali per uscita (normali + congelati)
  const totalExitPallets = exitSummary
    ? (exitSummary.tot_bancali_100x120 + exitSummary.tot_bancali_80x120 + exitSummary.tot_bancali_congelato)
    : 0;
  
  // Calcola i bancali normali per uscita (senza congelati)
  const normalExitPallets = exitSummary
    ? (exitSummary.tot_bancali_100x120 + exitSummary.tot_bancali_80x120)
    : 0;
  
  // Calcola i bancali totali per stoccaggio
  const totalStoragePallets = storageDetails ? (storageDetails.totalPallets + (storageDetails.totalPalletsCongelato || 0)) : 0;
  const normalStoragePallets = storageDetails?.totalPallets || 0;
  const congelatoStoragePallets = storageDetails?.totalPalletsCongelato || 0;
  
  // Formatta i dettagli ingresso (separando normali e congelati)
  const formatEntryDetails = () => {
    if (!entrySummary) return "";
    const normalParts = [];
    const congelatoParts = [];
    
    // Bancali normali
    if (entrySummary.numero_bancali_ingresso_100x120 > 0) {
      normalParts.push(`${entrySummary.numero_bancali_ingresso_100x120} bancali 100x120`);
    }
    if (entrySummary.numero_bancali_ingresso_80x120 > 0) {
      normalParts.push(`${entrySummary.numero_bancali_ingresso_80x120} bancali 80x120`);
    }
    
    // Bancali congelati
    if (entrySummary.numero_bancali_congelato > 0) {
      congelatoParts.push(`${entrySummary.numero_bancali_congelato} bancali congelati`);
    }
    
    const result = [];
    if (normalParts.length > 0) {
      result.push(normalParts.join(" e "));
    }
    if (congelatoParts.length > 0) {
      result.push(congelatoParts.join(" e "));
    }
    
    return result.length > 0 ? result.join("\n") : "Nessun bancale";
  };
  
  // Formatta i dettagli uscita (separando normali e congelati)
  const formatExitDetails = () => {
    if (!exitSummary) return "";
    const normalParts = [];
    const congelatoParts = [];
    
    // Bancali normali
    if (exitSummary.tot_bancali_100x120 > 0) {
      normalParts.push(`${exitSummary.tot_bancali_100x120} bancali 100x120`);
    }
    if (exitSummary.tot_bancali_80x120 > 0) {
      normalParts.push(`${exitSummary.tot_bancali_80x120} bancali 80x120`);
    }
    
    // Bancali congelati
    if (exitSummary.tot_bancali_congelato > 0) {
      congelatoParts.push(`${exitSummary.tot_bancali_congelato} bancali congelati`);
    }
    
    const result = [];
    if (normalParts.length > 0) {
      result.push(normalParts.join(" e "));
    }
    if (congelatoParts.length > 0) {
      result.push(congelatoParts.join(" e "));
    }
    
    return result.length > 0 ? result.join("\n") : "Nessun bancale";
  };
  
  // Formatta i dettagli stoccaggio
  const formatStorageDetails = () => {
    if (!storageDetails) return "";
    const parts = [];
    if (storageDetails.pallets100x120 > 0) {
      parts.push(`${storageDetails.pallets100x120} bancali 100x120`);
    }
    if (storageDetails.pallets80x120 > 0) {
      parts.push(`${storageDetails.pallets80x120} bancali 80x120`);
    }
    return parts.length > 0 ? parts.join(", ") : "Nessun bancale in stoccaggio";
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Database size={20} color={colors.primary} />
        <Text style={styles.title}>{displayMonthName}</Text>
      </View>
      
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Costo Totale:</Text>
        <Text style={styles.totalAmount}>{formatCurrency(totalCost)}</Text>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.detailsContainer}>
        {/* Costo Ingresso */}
        <TouchableOpacity 
          style={styles.detailRowTouchable}
          onPress={() => setExpandedEntry(!expandedEntry)}
          disabled={totalEntryPallets === 0}
        >
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <ArrowDownToLine size={16} color={colors.info} />
            </View>
            <View style={styles.detailContent}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailLabel}>Costo Ingresso:</Text>
                <Text style={[styles.detailAmount, { color: colors.info }]}>
                  {formatCurrency(entryCost)}
                </Text>
              </View>
              {totalEntryPallets > 0 && (
                <View>
                  <Text style={styles.palletsCount}>
                    {normalEntryPallets > 0 && `${normalEntryPallets} bancali normali`}
                    {normalEntryPallets > 0 && entrySummary?.numero_bancali_congelato > 0 && " + "}
                    {entrySummary?.numero_bancali_congelato > 0 && `${entrySummary.numero_bancali_congelato} congelati`}
                    {normalEntryPallets === 0 && entrySummary?.numero_bancali_congelato === 0 && "Nessun bancale"}
                  </Text>
                  {(entrySummary?.costi_ingresso_normali || entrySummary?.costi_ingresso_congelati) && (
                    <View style={{ marginTop: 4 }}>
                      {entrySummary.costi_ingresso_normali > 0 && (
                        <Text style={[styles.palletsCount, { fontSize: 11, color: colors.darkGray }]}>
                          Normali: {formatCurrency(entrySummary.costi_ingresso_normali)}
                        </Text>
                      )}
                      {entrySummary.costi_ingresso_congelati > 0 && (
                        <Text style={[styles.palletsCount, { fontSize: 11, color: colors.darkGray }]}>
                          Congelati: {formatCurrency(entrySummary.costi_ingresso_congelati)}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
            {totalEntryPallets > 0 && (
              expandedEntry ? <ChevronUp size={16} color={colors.darkGray} /> : <ChevronDown size={16} color={colors.darkGray} />
            )}
          </View>
        </TouchableOpacity>
        {expandedEntry && totalEntryPallets > 0 && (
          <View style={styles.expandedDetails}>
            <Text style={styles.expandedText}>
              <Text style={styles.expandedSectionTitle}>Bancali Normali:{'\n'}</Text>
              <Text style={styles.expandedText}>
                {entrySummary && (entrySummary.numero_bancali_ingresso_100x120 > 0 || entrySummary.numero_bancali_ingresso_80x120 > 0) ? (
                  [
                    entrySummary.numero_bancali_ingresso_100x120 > 0 && `${entrySummary.numero_bancali_ingresso_100x120} bancali 100x120`,
                    entrySummary.numero_bancali_ingresso_80x120 > 0 && `${entrySummary.numero_bancali_ingresso_80x120} bancali 80x120`
                  ].filter(Boolean).join(" e ")
                ) : "Nessun bancale normale"}
              </Text>
              {entrySummary && (entrySummary.numero_bancali_ingresso_100x120 > 0 || entrySummary.numero_bancali_ingresso_80x120 > 0) && (
                <Text style={styles.equivalentText}>
                  {'\n'}Totale equivalenti: {entrySummary.equivalenza_100x120 + entrySummary.numero_bancali_ingresso_80x120} bancali
                </Text>
              )}
              {entrySummary?.numero_bancali_congelato > 0 && (
                <>
                  <Text style={styles.expandedSectionTitle}>{'\n'}Bancali Congelati:{'\n'}</Text>
                  <Text style={styles.expandedText}>
                    {entrySummary.numero_bancali_congelato} bancali congelati
                  </Text>
                  <Text style={styles.equivalentText}>
                    {'\n'}Equivalenza: {entrySummary.equivalenza_bancali_congelato} bancali
                  </Text>
                </>
              )}
            </Text>
          </View>
        )}
        
        {/* Costo Uscita */}
        <TouchableOpacity 
          style={styles.detailRowTouchable}
          onPress={() => setExpandedExit(!expandedExit)}
          disabled={totalExitPallets === 0}
        >
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <ArrowUpFromLine size={16} color={colors.warning} />
            </View>
            <View style={styles.detailContent}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailLabel}>Costo Uscita:</Text>
                <Text style={[styles.detailAmount, { color: colors.warning }]}>
                  {formatCurrency(exitCost)}
                </Text>
              </View>
              {totalExitPallets > 0 && (
                <View>
                  <Text style={styles.palletsCount}>
                    {normalExitPallets > 0 && `${normalExitPallets} bancali normali`}
                    {normalExitPallets > 0 && exitSummary?.tot_bancali_congelato > 0 && " + "}
                    {exitSummary?.tot_bancali_congelato > 0 && `${exitSummary.tot_bancali_congelato} congelati`}
                    {normalExitPallets === 0 && exitSummary?.tot_bancali_congelato === 0 && "Nessun bancale"}
                  </Text>
                  {(exitSummary?.costi_uscita_normali || exitSummary?.costi_uscita_congelati) && (
                    <View style={{ marginTop: 4 }}>
                      {exitSummary.costi_uscita_normali > 0 && (
                        <Text style={[styles.palletsCount, { fontSize: 11, color: colors.darkGray }]}>
                          Normali: {formatCurrency(exitSummary.costi_uscita_normali)}
                        </Text>
                      )}
                      {exitSummary.costi_uscita_congelati > 0 && (
                        <Text style={[styles.palletsCount, { fontSize: 11, color: colors.darkGray }]}>
                          Congelati: {formatCurrency(exitSummary.costi_uscita_congelati)}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
            {totalExitPallets > 0 && (
              expandedExit ? <ChevronUp size={16} color={colors.darkGray} /> : <ChevronDown size={16} color={colors.darkGray} />
            )}
          </View>
        </TouchableOpacity>
        {expandedExit && totalExitPallets > 0 && (
          <View style={styles.expandedDetails}>
            <Text style={styles.expandedText}>
              <Text style={styles.expandedSectionTitle}>Bancali Normali:{'\n'}</Text>
              <Text style={styles.expandedText}>
                {exitSummary && (exitSummary.tot_bancali_100x120 > 0 || exitSummary.tot_bancali_80x120 > 0) ? (
                  [
                    exitSummary.tot_bancali_100x120 > 0 && `${exitSummary.tot_bancali_100x120} bancali 100x120`,
                    exitSummary.tot_bancali_80x120 > 0 && `${exitSummary.tot_bancali_80x120} bancali 80x120`
                  ].filter(Boolean).join(" e ")
                ) : "Nessun bancale normale"}
              </Text>
              {exitSummary && (exitSummary.tot_bancali_100x120 > 0 || exitSummary.tot_bancali_80x120 > 0) && (
                <Text style={styles.equivalentText}>
                  {'\n'}Totale equivalenti: {exitSummary.equivalenza_100x120 + exitSummary.tot_bancali_80x120} bancali
                </Text>
              )}
              {exitSummary?.tot_bancali_congelato > 0 && (
                <>
                  <Text style={styles.expandedSectionTitle}>{'\n'}Bancali Congelati:{'\n'}</Text>
                  <Text style={styles.expandedText}>
                    {exitSummary.tot_bancali_congelato} bancali congelati
                  </Text>
                  <Text style={styles.equivalentText}>
                    {'\n'}Equivalenza: {exitSummary.equivalenza_congelato} bancali
                  </Text>
                </>
              )}
            </Text>
          </View>
        )}
        
        {/* Costo Stoccaggio */}
        <TouchableOpacity 
          style={styles.detailRowTouchable}
          onPress={() => setExpandedStorage(!expandedStorage)}
          disabled={totalStoragePallets === 0}
        >
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Clock size={16} color={colors.secondary} />
            </View>
            <View style={styles.detailContent}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailLabel}>Costo Stoccaggio:</Text>
                <Text style={[styles.detailAmount, { color: colors.secondary }]}>
                  {formatCurrency(storageCost)}
                </Text>
              </View>
              {totalStoragePallets > 0 && (
                <View>
                  <Text style={styles.palletsCount}>
                    {normalStoragePallets > 0 && `${normalStoragePallets} bancali normali`}
                    {normalStoragePallets > 0 && congelatoStoragePallets > 0 && " + "}
                    {congelatoStoragePallets > 0 && `${congelatoStoragePallets} congelati`}
                    {normalStoragePallets === 0 && congelatoStoragePallets === 0 && "Nessun bancale in stoccaggio"}
                  </Text>
                </View>
              )}
            </View>
            {totalStoragePallets > 0 && (
              expandedStorage ? <ChevronUp size={16} color={colors.darkGray} /> : <ChevronDown size={16} color={colors.darkGray} />
            )}
          </View>
        </TouchableOpacity>
        {expandedStorage && totalStoragePallets > 0 && (
          <View style={styles.expandedDetails}>
            <Text style={styles.expandedText}>
              <Text style={styles.expandedSectionTitle}>Bancali Normali:{'\n'}</Text>
              <Text style={styles.expandedText}>
                {storageDetails && (storageDetails.pallets100x120 > 0 || storageDetails.pallets80x120 > 0) ? (
                  [
                    storageDetails.pallets100x120 > 0 && `${storageDetails.pallets100x120} bancali 100x120`,
                    storageDetails.pallets80x120 > 0 && `${storageDetails.pallets80x120} bancali 80x120`
                  ].filter(Boolean).join(" e ")
                ) : "Nessun bancale normale in stoccaggio"}
              </Text>
              {storageDetails && (storageDetails.pallets100x120 > 0 || storageDetails.pallets80x120 > 0) && storageDetails.equivalentPallets !== undefined && (
                <Text style={styles.equivalentText}>
                  {'\n'}Totale equivalenti: {storageDetails.equivalentPallets} bancali
                </Text>
              )}
              {storageDetails && storageDetails.totalPalletsCongelato > 0 && (
                <>
                  <Text style={styles.expandedSectionTitle}>{'\n'}Bancali Congelati:{'\n'}</Text>
                  <Text style={styles.expandedText}>
                    {storageDetails.palletsCongelato100x120 > 0 && `${storageDetails.palletsCongelato100x120} bancali 100x120`}
                    {storageDetails.palletsCongelato100x120 > 0 && storageDetails.palletsCongelato80x120 > 0 && " e "}
                    {storageDetails.palletsCongelato80x120 > 0 && `${storageDetails.palletsCongelato80x120} bancali 80x120`}
                    {storageDetails.palletsCongelato100x120 === 0 && storageDetails.palletsCongelato80x120 === 0 && "Nessun bancale congelato"}
                  </Text>
                  {storageDetails.equivalentPalletsCongelato !== undefined && storageDetails.equivalentPalletsCongelato > 0 && (
                    <Text style={styles.equivalentText}>
                      {'\n'}Equivalenza: {storageDetails.equivalentPalletsCongelato} bancali
                    </Text>
                  )}
                </>
              )}
            </Text>
          </View>
        )}
        
        {isCurrentMonth && projectedStorageCost !== undefined && (
          <View style={styles.projectionContainer}>
            <Text style={styles.projectionLabel}>
              Stoccaggio Previsto (Fine Mese):
            </Text>
            <Text style={styles.projectionAmount}>
              {formatCurrency(projectedStorageCost)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const shadowStyle = createShadowStyle("#000", { width: 0, height: 2 }, 0.1, 4, 2);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...shadowStyle,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginLeft: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
  },
  totalAmount: {
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
  detailRowTouchable: {
    borderRadius: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailContent: {
    flex: 1,
    marginLeft: 8,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  palletsCount: {
    fontSize: 12,
    color: colors.darkGray,
    marginTop: 2,
    fontStyle: "italic",
  },
  expandedDetails: {
    marginLeft: 36,
    marginTop: 4,
    padding: 8,
    backgroundColor: colors.lightGray,
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
  },
  expandedText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  expandedSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginTop: 4,
  },
  equivalentText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.primary,
    fontStyle: "italic",
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.lightGray,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.darkGray,
  },
  detailAmount: {
    fontSize: 16,
    fontWeight: "500",
  },
  projectionContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.info,
  },
  projectionLabel: {
    fontSize: 14,
    color: colors.darkGray,
    marginBottom: 4,
  },
  projectionAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.info,
  },
});