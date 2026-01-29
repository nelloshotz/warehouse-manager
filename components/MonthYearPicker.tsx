import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from "react-native";
import { colors } from "@/constants/colors";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react-native";

interface MonthYearPickerProps {
  selectedDate: { month: number; year: number };
  onSelect: (date: { month: number; year: number }) => void;
  startYear?: number;
  endYear?: number;
}

export default function MonthYearPicker({
  selectedDate,
  onSelect,
  startYear = 2023,
  endYear = new Date().getFullYear(),
}: MonthYearPickerProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [tempDate, setTempDate] = useState(selectedDate);
  
  const months = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];
  
  const years = Array.from(
    { length: endYear - startYear + 1 },
    (_, i) => startYear + i
  ).reverse();
  
  const handlePrevMonth = () => {
    const newDate = { ...selectedDate };
    if (newDate.month === 1) {
      if (newDate.year > startYear) {
        newDate.month = 12;
        newDate.year -= 1;
      }
    } else {
      newDate.month -= 1;
    }
    onSelect(newDate);
  };
  
  const handleNextMonth = () => {
    const newDate = { ...selectedDate };
    if (newDate.month === 12) {
      if (newDate.year < endYear) {
        newDate.month = 1;
        newDate.year += 1;
      }
    } else {
      newDate.month += 1;
    }
    onSelect(newDate);
  };
  
  const handleOpenModal = () => {
    setTempDate(selectedDate);
    setIsModalVisible(true);
  };
  
  const handleCloseModal = () => {
    setIsModalVisible(false);
  };
  
  const handleSelectMonth = (month: number) => {
    setTempDate({ ...tempDate, month });
  };
  
  const handleSelectYear = (year: number) => {
    setTempDate({ ...tempDate, year });
  };
  
  const handleApply = () => {
    onSelect(tempDate);
    setIsModalVisible(false);
  };
  
  const formatDate = (date: { month: number; year: number }) => {
    return `${months[date.month - 1]} ${date.year}`;
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.pickerContainer}>
        <TouchableOpacity 
          style={styles.arrowButton} 
          onPress={handlePrevMonth}
        >
          <ChevronLeft size={20} color={colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.dateButton} onPress={handleOpenModal}>
          <Calendar size={16} color={colors.primary} style={styles.calendarIcon} />
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          <ChevronDown size={16} color={colors.darkGray} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.arrowButton} 
          onPress={handleNextMonth}
        >
          <ChevronRight size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
      
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleziona Mese e Anno</Text>
            
            <View style={styles.selectionContainer}>
              <View style={styles.monthsContainer}>
                <Text style={styles.sectionTitle}>Mese</Text>
                <FlatList
                  data={months}
                  keyExtractor={(item, index) => `month-${index}`}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={[
                        styles.selectionItem,
                        tempDate.month === index + 1 && styles.selectedItem,
                      ]}
                      onPress={() => handleSelectMonth(index + 1)}
                    >
                      <Text
                        style={[
                          styles.selectionText,
                          tempDate.month === index + 1 && styles.selectedText,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                  showsVerticalScrollIndicator={false}
                  style={styles.list}
                />
              </View>
              
              <View style={styles.yearsContainer}>
                <Text style={styles.sectionTitle}>Anno</Text>
                <FlatList
                  data={years}
                  keyExtractor={(item) => `year-${item}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.selectionItem,
                        tempDate.year === item && styles.selectedItem,
                      ]}
                      onPress={() => handleSelectYear(item)}
                    >
                      <Text
                        style={[
                          styles.selectionText,
                          tempDate.year === item && styles.selectedText,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                  showsVerticalScrollIndicator={false}
                  style={styles.list}
                />
              </View>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCloseModal}
              >
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.applyButton]}
                onPress={handleApply}
              >
                <Text style={styles.applyButtonText}>Applica</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  pickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calendarIcon: {
    marginRight: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
    marginRight: 8,
  },
  arrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    width: "90%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 16,
    textAlign: "center",
  },
  selectionContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  monthsContainer: {
    flex: 1,
    marginRight: 8,
  },
  yearsContainer: {
    flex: 1,
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.darkGray,
    marginBottom: 8,
  },
  list: {
    maxHeight: 300,
  },
  selectionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  selectedItem: {
    backgroundColor: colors.primary + "20",
  },
  selectionText: {
    fontSize: 16,
    color: colors.text,
  },
  selectedText: {
    color: colors.primary,
    fontWeight: "600",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: colors.lightGray,
    marginRight: 8,
  },
  applyButton: {
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "500",
  },
  applyButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: "500",
  },
});