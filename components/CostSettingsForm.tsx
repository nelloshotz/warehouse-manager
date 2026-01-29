import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { useSettingsStore } from "@/store/settingsStore";
import { colors } from "@/constants/colors";
import { Save, Plus, Minus } from "lucide-react-native";
import { createShadowStyle } from "@/utils/shadowStyles";

export default function CostSettingsForm() {
  const { costSettings, updateCostSettings, exitColumns, addExitColumn, removeExitColumn } = useSettingsStore();
  
  const [formValues, setFormValues] = useState({
    costo_ingresso: costSettings.costo_ingresso.toString(),
    costo_uscita: costSettings.costo_uscita.toString(),
    costo_storage: costSettings.costo_storage.toString(),
    costo_congelato: costSettings.costo_congelato.toString(),
  });

  const handleChange = (name: string, value: string) => {
    setFormValues({
      ...formValues,
      [name]: value,
    });
  };

  const handleSave = () => {
    updateCostSettings({
      costo_ingresso: parseFloat(formValues.costo_ingresso) || costSettings.costo_ingresso,
      costo_uscita: parseFloat(formValues.costo_uscita) || costSettings.costo_uscita,
      costo_storage: parseFloat(formValues.costo_storage) || costSettings.costo_storage,
      costo_congelato: parseFloat(formValues.costo_congelato) || costSettings.costo_congelato,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Impostazioni Costi</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Costo Ingresso (€)</Text>
        <TextInput
          style={styles.input}
          value={formValues.costo_ingresso}
          onChangeText={(value) => handleChange("costo_ingresso", value)}
          keyboardType="numeric"
          placeholder="Costo ingresso"
        />
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Costo Uscita (€)</Text>
        <TextInput
          style={styles.input}
          value={formValues.costo_uscita}
          onChangeText={(value) => handleChange("costo_uscita", value)}
          keyboardType="numeric"
          placeholder="Costo uscita"
        />
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Costo Stoccaggio (€ al giorno)</Text>
        <TextInput
          style={styles.input}
          value={formValues.costo_storage}
          onChangeText={(value) => handleChange("costo_storage", value)}
          keyboardType="numeric"
          placeholder="Costo stoccaggio"
        />
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Costo Congelato (€)</Text>
        <TextInput
          style={styles.input}
          value={formValues.costo_congelato}
          onChangeText={(value) => handleChange("costo_congelato", value)}
          keyboardType="numeric"
          placeholder="Costo congelato"
        />
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Colonne Uscita</Text>
        <View style={styles.counterContainer}>
          <TouchableOpacity 
            style={styles.counterButton} 
            onPress={removeExitColumn}
            disabled={exitColumns <= 1}
          >
            <Minus size={16} color={exitColumns <= 1 ? colors.mediumGray : colors.text} />
          </TouchableOpacity>
          <Text style={styles.counterText}>{exitColumns}</Text>
          <TouchableOpacity 
            style={styles.counterButton} 
            onPress={addExitColumn}
            disabled={exitColumns >= 20}
          >
            <Plus size={16} color={exitColumns >= 20 ? colors.mediumGray : colors.text} />
          </TouchableOpacity>
        </View>
      </View>
      
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Save size={18} color={colors.card} />
        <Text style={styles.saveButtonText}>Salva Impostazioni</Text>
      </TouchableOpacity>
    </View>
  );
}

const containerShadow = createShadowStyle("#000", { width: 0, height: 2 }, 0.1, 4, 2);
const buttonShadow = createShadowStyle("#000", { width: 0, height: 1 }, 0.1, 1, 1);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...containerShadow,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: colors.darkGray,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  counterContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    padding: 8,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
    ...buttonShadow,
  },
  counterText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    paddingHorizontal: 16,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});