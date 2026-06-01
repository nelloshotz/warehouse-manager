import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { colors } from "@/constants/colors";
import { Plus, X } from "lucide-react-native";
import { useRawMaterialsProductsStore } from "@/store/rawMaterialsProductsStore";
import { sanitizeProductName } from "@/utils/rawMaterialsReport";

interface RawMaterialsProductsEditModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function RawMaterialsProductsEditModal({
  visible,
  onClose,
}: RawMaterialsProductsEditModalProps) {
  const products = useRawMaterialsProductsStore((state) => state.products);
  const addProduct = useRawMaterialsProductsStore((state) => state.addProduct);
  const removeProduct = useRawMaterialsProductsStore((state) => state.removeProduct);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const handleClose = () => {
    setShowAddForm(false);
    setNewProductName("");
    setAddError(null);
    onClose();
  };

  const handleAddProduct = () => {
    const cleaned = sanitizeProductName(newProductName);
    setNewProductName(cleaned);
    const result = addProduct(cleaned);
    if (!result.ok) {
      setAddError(result.error || "Impossibile aggiungere il prodotto.");
      return;
    }
    setNewProductName("");
    setAddError(null);
    setShowAddForm(false);
  };

  const confirmDelete = (productName: string) => {
    const message = `Sei sicuro di voler eliminare "${productName}"?`;

    if (Platform.OS === "web") {
      const confirmed = window.confirm(message);
      if (confirmed) removeProduct(productName);
      return;
    }

    Alert.alert("Conferma eliminazione", message, [
      { text: "Annulla", style: "cancel" },
      { text: "OK", onPress: () => removeProduct(productName) },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>Gestione prodotti</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {products.map((product) => (
              <View key={product} style={styles.productRow}>
                <Text style={styles.productName}>{product}</Text>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => confirmDelete(product)}
                  accessibilityLabel={`Elimina ${product}`}
                >
                  <X size={18} color={colors.warning} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            {showAddForm ? (
              <View style={styles.addForm}>
                <Text style={styles.addLabel}>Nome prodotto da aggiungere</Text>
                <TextInput
                  style={styles.input}
                  value={newProductName}
                  onChangeText={(value) => {
                    setNewProductName(value);
                    if (addError) setAddError(null);
                  }}
                  onBlur={() => setNewProductName((value) => sanitizeProductName(value))}
                  placeholder="Es. AMIDO DI MAIS"
                  autoCapitalize="characters"
                />
                {addError && <Text style={styles.addError}>{addError}</Text>}
                <View style={styles.addActions}>
                  <TouchableOpacity
                    style={styles.cancelAddButton}
                    onPress={() => {
                      setShowAddForm(false);
                      setNewProductName("");
                      setAddError(null);
                    }}
                  >
                    <Text style={styles.cancelAddText}>Annulla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveAddButton} onPress={handleAddProduct}>
                    <Text style={styles.saveAddText}>Salva</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm(true)}>
                <Plus size={18} color={colors.primary} />
                <Text style={styles.addButtonText}>Aggiungi prodotto</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 16,
  },
  panel: {
    backgroundColor: colors.card,
    borderRadius: 12,
    maxHeight: "85%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    maxHeight: 420,
  },
  listContent: {
    padding: 12,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 8,
  },
  productName: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 12,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  addButtonText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 14,
  },
  addForm: {
    gap: 8,
  },
  addLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.darkGray,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },
  addError: {
    color: colors.warning,
    fontSize: 12,
  },
  addActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  cancelAddButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelAddText: {
    color: colors.darkGray,
    fontWeight: "600",
  },
  saveAddButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  saveAddText: {
    color: colors.card,
    fontWeight: "600",
  },
});
