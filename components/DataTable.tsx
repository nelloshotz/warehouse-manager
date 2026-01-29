import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { colors } from "@/constants/colors";
import { ChevronUp, ChevronDown } from "lucide-react-native";

interface Column {
  key: string;
  title: string;
  render?: (value: any, item: any) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps {
  data: any[];
  columns: Column[];
  emptyMessage?: string;
  onRowPress?: (item: any) => void;
}

export default function DataTable({
  data,
  columns,
  emptyMessage = "Nessun dato disponibile",
  onRowPress,
}: DataTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [sortedData, setSortedData] = useState([...data]);

  React.useEffect(() => {
    if (sortColumn) {
      const sorted = [...data].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        // Gestisci confronti numerici e stringhe
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal || '').localeCompare(String(bVal || ''));
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
      setSortedData(sorted);
    } else {
      setSortedData([...data]);
    }
  }, [data, sortColumn, sortDirection]);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('desc');
    }
  };

  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
      <View style={styles.tableContainer}>
        {/* Intestazione */}
        <View style={styles.headerRow}>
          {columns.map((column) => {
            const isSortable = column.sortable !== false;
            const isSorted = sortColumn === column.key;
            
            return (
              <TouchableOpacity
                key={column.key}
                style={styles.headerCell}
                onPress={() => isSortable && handleSort(column.key)}
                disabled={!isSortable}
              >
                <View style={styles.headerCellContent}>
              <Text style={styles.headerText}>{column.title}</Text>
                  {isSortable && (
                    <View style={styles.sortIndicator}>
                      {isSorted ? (
                        sortDirection === 'asc' ? (
                          <ChevronUp size={14} color={colors.card} />
                        ) : (
                          <ChevronDown size={14} color={colors.card} />
                        )
                      ) : (
                        <View style={styles.sortPlaceholder} />
                      )}
                    </View>
                  )}
            </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Righe */}
        {sortedData.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dataRow,
              index % 2 === 0 ? styles.evenRow : styles.oddRow,
              onRowPress && styles.clickableRow,
            ]}
            onPress={() => onRowPress && onRowPress(item)}
            disabled={!onRowPress}
          >
            {columns.map((column) => (
              <View key={column.key} style={styles.dataCell}>
                {column.render ? (
                  column.render(item[column.key], item)
                ) : (
                  <Text style={styles.dataText}>
                    {item[column.key]?.toString() || "-"}
                  </Text>
                )}
              </View>
            ))}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tableContainer: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: colors.primary,
  },
  headerCell: {
    padding: 12,
    minWidth: 120,
    justifyContent: "center",
  },
  headerCellContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerText: {
    color: colors.card,
    fontWeight: "600",
    fontSize: 14,
  },
  sortIndicator: {
    marginLeft: 4,
  },
  sortPlaceholder: {
    width: 14,
    height: 14,
  },
  dataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  clickableRow: {
    opacity: 1,
  },
  evenRow: {
    backgroundColor: colors.card,
  },
  oddRow: {
    backgroundColor: colors.lightGray,
  },
  dataCell: {
    padding: 12,
    minWidth: 120,
    justifyContent: "center",
  },
  dataText: {
    color: colors.text,
    fontSize: 14,
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lightGray,
    borderRadius: 8,
  },
  emptyText: {
    color: colors.darkGray,
    fontSize: 16,
  },
});