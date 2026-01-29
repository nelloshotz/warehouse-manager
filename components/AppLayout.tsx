import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { colors } from "@/constants/colors";
import { 
  Menu, 
  X, 
  Database,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  FileText,
  FileBarChart,
  TrendingUp,
  Settings
} from "lucide-react-native";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    { title: "Dashboard", icon: Database, route: "/(tabs)", color: colors.primary },
    { title: "Ingressi", icon: ArrowDownToLine, route: "/(tabs)/entries", color: colors.info },
    { title: "Uscite", icon: ArrowUpFromLine, route: "/(tabs)/exits", color: colors.warning },
    { title: "Stoccaggio", icon: Clock, route: "/(tabs)/storage", color: colors.secondary },
    { title: "Documenti", icon: FileText, route: "/(tabs)/documents", color: colors.primary },
    { title: "Report Mensili", icon: FileBarChart, route: "/(tabs)/reports", color: colors.primary },
    { title: "Panoramica Annuale", icon: TrendingUp, route: "/(tabs)/yearly", color: colors.primary },
    { title: "Impostazioni", icon: Settings, route: "/(tabs)/settings", color: colors.darkGray },
  ];

  const navigateTo = (route: string) => {
    router.push(route as any);
    setMenuVisible(false);
  };

  const isActive = (route: string) => {
    const current = pathname?.replace(/\/$/, '') || '/(tabs)';
    const itemRoute = route.replace(/\/$/, '');
    return current === itemRoute || (current === '/(tabs)' && route === '/(tabs)');
  };

  return (
    <View style={styles.container}>
      {/* Header fisso */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => setMenuVisible(true)}
        >
          <Menu size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          {(() => {
            const activeItem = menuItems.find(item => isActive(item.route));
            if (activeItem) {
              const Icon = activeItem.icon;
              return (
                <View style={styles.titleRow}>
                  <Icon size={20} color={activeItem.color} />
                  <View style={{ width: 8 }} />
                  <Text style={styles.titleText}>
                    {activeItem.title}
                  </Text>
                </View>
              );
            }
            return <Text style={styles.titleText}>Dashboard</Text>;
          })()}
        </View>
      </View>

      {/* Contenuto principale */}
      <View style={styles.content}>
        {children}
      </View>

      {/* Menu laterale */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <View style={styles.menuTitleContainer}>
                <Database size={24} color={colors.primary} />
                <View style={{ width: 8 }} />
                <Text style={styles.menuTitle}>Gestione Magazzino</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setMenuVisible(false)}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.menuList}>
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                const active = isActive(item.route);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.menuItem,
                      active && styles.menuItemActive
                    ]}
                    onPress={() => navigateTo(item.route)}
                  >
                    <Icon size={20} color={active ? item.color : colors.darkGray} />
                    <View style={{ width: 12 }} />
                    <Text style={[
                      styles.menuItemText,
                      active && { color: item.color, fontWeight: '600' }
                    ]}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 60,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    flexDirection: "row",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  menuContainer: {
    width: 280,
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  menuHeader: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  menuList: {
    flex: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemActive: {
    backgroundColor: colors.lightGray,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.text,
  },
});

