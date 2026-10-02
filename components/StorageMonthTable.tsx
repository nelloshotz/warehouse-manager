import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";
import { formatCurrency } from "@/utils/calculations";
import { DocumentMonthStorage } from "@/utils/storageCalculation";

export { splitByRegime } from "@/utils/storageCalculation";

/** Formatta YYYY-MM-DD come GG/MM */
export function formatDayMonth(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

/** Tariffa giornaliera con tutte le cifre significative (es. 0,233333 €) */
export function formatTariffa(value: number): string {
  return `${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} €`;
}

export function regimeLabel(congelato: boolean): string {
  return congelato ? "Congelato" : "Ambient";
}

interface StorageMonthTableProps {
  /** Stoccaggio di un documento in un mese */
  entry: DocumentMonthStorage;
}

function RegimeBadge({ congelato }: { congelato: boolean }) {
  return (
    <View style={[styles.colRegime, styles.badgeCell]}>
      <Text style={[styles.badge, congelato ? styles.badgeCongelato : styles.badgeAmbient]}>
        {regimeLabel(congelato)}
      </Text>
    </View>
  );
}

/**
 * Stoccaggio di un documento in un mese: uscite, dettaglio riga per riga (solo bancali)
 * e calcolo sul totale del documento (bancali totali, equivalenza, costo).
 */
export default function StorageMonthTable({ entry }: StorageMonthTableProps) {
  const uscite = entry.righe
    .flatMap((r) => r.usciteNelMese.map((u) => ({ ...u, tipologia: r.tipologia, congelato: r.congelato })))
    .sort((a, b) => a.data.localeCompare(b.data));

  return (
    <View>
      {uscite.length > 0 && (
        <Text style={styles.exits}>
          Uscite:{" "}
          {uscite
            .map((u) => `${formatDayMonth(u.data)} · ${u.bancali} bancali ${u.tipologia} ${regimeLabel(u.congelato).toLowerCase()}`)
            .join(" — ")}
        </Text>
      )}

      <Text style={styles.subTitle}>Dettaglio righe</Text>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.cell, styles.colPeriodo, styles.headerText]}>Periodo</Text>
        <Text style={[styles.cell, styles.colGiorni, styles.headerText]}>Giorni</Text>
        <Text style={[styles.cell, styles.colTipo, styles.headerText]}>Tipo</Text>
        <Text style={[styles.cell, styles.colRegime, styles.headerText]}>Regime</Text>
        <Text style={[styles.cell, styles.colNum, styles.headerText]}>Bancali</Text>
        <Text style={[styles.cell, styles.colNum]} />
        <Text style={[styles.cell, styles.colTariffa]} />
        <Text style={[styles.cell, styles.colCosto]} />
      </View>
      {entry.righe.map((r) =>
        r.periodi.map((p, idx) => (
          <View key={`${r.rowId}-${idx}`} style={styles.row}>
            <Text style={[styles.cell, styles.colPeriodo]}>
              {formatDayMonth(p.dal)} – {formatDayMonth(p.al)}
            </Text>
            <Text style={[styles.cell, styles.colGiorni]}>{p.giorni}</Text>
            <Text style={[styles.cell, styles.colTipo]}>{r.tipologia}</Text>
            <RegimeBadge congelato={r.congelato} />
            <Text style={[styles.cell, styles.colNum]}>{p.bancali}</Text>
            <Text style={[styles.cell, styles.colNum]} />
            <Text style={[styles.cell, styles.colTariffa]} />
            <Text style={[styles.cell, styles.colCosto]} />
          </View>
        ))
      )}

      <Text style={[styles.subTitle, styles.subTitleTotal]}>Calcolo sul totale documento</Text>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.cell, styles.colPeriodo, styles.headerText]}>Periodo</Text>
        <Text style={[styles.cell, styles.colGiorni, styles.headerText]}>Giorni</Text>
        <Text style={[styles.cell, styles.colTipo, styles.headerText]}>Tipo</Text>
        <Text style={[styles.cell, styles.colRegime, styles.headerText]}>Regime</Text>
        <Text style={[styles.cell, styles.colNum, styles.headerText]}>Bancali tot.</Text>
        <Text style={[styles.cell, styles.colNum, styles.headerText]}>Equiv.</Text>
        <Text style={[styles.cell, styles.colTariffa, styles.headerText]}>Tariffa</Text>
        <Text style={[styles.cell, styles.colCosto, styles.headerText]}>Costo</Text>
      </View>
      {entry.gruppi.map((g) =>
        g.periodi.map((p, idx) => (
          <View key={`${g.tipologia}-${g.congelato}-${idx}`} style={[styles.row, styles.totalRow]}>
            <Text style={[styles.cell, styles.colPeriodo]}>
              {formatDayMonth(p.dal)} – {formatDayMonth(p.al)}
            </Text>
            <Text style={[styles.cell, styles.colGiorni]}>{p.giorni}</Text>
            <Text style={[styles.cell, styles.colTipo]}>{g.tipologia}</Text>
            <RegimeBadge congelato={g.congelato} />
            <Text style={[styles.cell, styles.colNum, styles.bold]}>{p.bancali}</Text>
            <Text style={[styles.cell, styles.colNum, styles.bold]}>{p.equivalenti}</Text>
            <Text style={[styles.cell, styles.colTariffa]}>{formatTariffa(p.tariffa)}</Text>
            <Text style={[styles.cell, styles.colCosto, styles.bold]}>{formatCurrency(p.costo)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  exits: {
    fontSize: 12,
    color: colors.warning,
    marginBottom: 4,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.darkGray,
    marginTop: 4,
    marginBottom: 2,
  },
  subTitleTotal: {
    marginTop: 10,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 4,
  },
  headerRow: {
    borderBottomColor: colors.mediumGray,
  },
  totalRow: {
    backgroundColor: colors.lightGray,
  },
  headerText: {
    color: colors.darkGray,
  },
  bold: {
    fontWeight: "600",
  },
  cell: {
    fontSize: 12,
    color: colors.text,
    paddingHorizontal: 3,
  },
  colPeriodo: { flex: 2.3 },
  colGiorni: { flex: 0.9, textAlign: "right" },
  colTipo: { flex: 1.3 },
  colRegime: { flex: 1.6 },
  colNum: { flex: 1.1, textAlign: "right" },
  colTariffa: { flex: 1.5, textAlign: "right" },
  colCosto: { flex: 1.5, textAlign: "right" },
  badgeCell: {
    paddingHorizontal: 3,
    alignItems: "flex-start",
  },
  badge: {
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: "hidden",
  },
  badgeAmbient: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  badgeCongelato: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
  },
});
