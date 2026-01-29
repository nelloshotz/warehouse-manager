import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { useWarehouseStore } from "@/store/warehouseStore";
import { colors } from "@/constants/colors";
import { FileText, Trash2, Calendar, FileDigit } from "lucide-react-native";
import { createShadowStyle } from "@/utils/shadowStyles";

export default function UploadedFilesList() {
  const { uploadedFiles, removeUploadedFile } = useWarehouseStore();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDeleteFile = (fileId: string) => {
    removeUploadedFile(fileId);
  };

  if (uploadedFiles.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <FileText color={colors.mediumGray} size={40} />
        <Text style={styles.emptyText}>Nessun file caricato</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={uploadedFiles}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.fileItem}>
          <View style={styles.fileIconContainer}>
            <FileDigit color={colors.primary} size={24} />
          </View>
          <View style={styles.fileDetails}>
            <Text style={styles.fileName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.fileInfo}>
              <Text style={styles.fileSize}>{formatFileSize(item.size)}</Text>
              <View style={styles.dateContainer}>
                <Calendar size={12} color={colors.darkGray} />
                <Text style={styles.fileDate}>{formatDate(item.uploadDate)}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteFile(item.id)}
          >
            <Trash2 size={18} color={colors.notification} />
          </TouchableOpacity>
        </View>
      )}
      contentContainerStyle={styles.listContainer}
    />
  );
}

const fileItemShadow = createShadowStyle("#000", { width: 0, height: 1 }, 0.05, 2, 1);

const styles = StyleSheet.create({
  listContainer: {
    paddingBottom: 16,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    ...fileItemShadow,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.lightGray,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
    marginBottom: 4,
  },
  fileInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  fileSize: {
    fontSize: 12,
    color: colors.darkGray,
    marginRight: 12,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  fileDate: {
    fontSize: 12,
    color: colors.darkGray,
    marginLeft: 4,
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.darkGray,
  },
});