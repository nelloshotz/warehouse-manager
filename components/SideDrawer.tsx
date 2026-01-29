import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/colors";
import { 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Clock, 
  Database, 
  FileBarChart,
  FileText,
  Settings,
  TrendingUp
} from "lucide-react-native";

interface SideDrawerProps {
  onClose: () => void;
  currentRoute: string;
}

export default function SideDrawer({ onClose, currentRoute }: SideDrawerProps) {
  const router = useRouter();
  
  const menuItems = [
    {
      title: "Dashboard",
      icon: <Database size={20} color={colors.text} />,
      route: "/(tabs)",
    },
    {
      title: "Ingressi",
      icon: <ArrowDownToLine size={20} color={colors.info} />,
      route: "/(tabs)/entries",
    },
    {
      title: "Uscite",
      icon: <ArrowUpFromLine size={20} color={colors.warning} />,
      route: "/(tabs)/exits",
    },
    {
      title: "Stoccaggio",
      icon: <Clock size={20} color={colors.secondary} />,
      route: "/(tabs)/storage",
    },
    {
      title: "Documenti",
      icon: <FileText size={20} color={colors.primary} />,
      route: "/(tabs)/documents",
    },
    {
      title: "Report Mensili",
      icon: <FileBarChart size={20} color={colors.primary} />,
      route: "/(tabs)/reports",
    },
    {
      title: "Panoramica Annuale",
      icon: <TrendingUp size={20} color={colors.primary} />,
      route: "/(tabs)/yearly",
    },
    {
      title: "Impostazioni",
      icon: <Settings size={20} color={colors.text} />,
      route: "/(tabs)/settings",
    },
  ];
  
  const handleNavigation = (route: string) => {
    router.push(route as any);
    onClose();
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestione Magazzino</Text>
      </View>
      
      <ScrollView style={styles.menuContainer}>
        {menuItems.map((item, index) => {
          // Normalizza le route per il confronto
          const normalizedCurrentRoute = currentRoute.replace(/\/$/, '') || '/(tabs)';
          const normalizedItemRoute = item.route.replace(/\/$/, '');
          const isActive = normalizedCurrentRoute === normalizedItemRoute || 
                          (normalizedCurrentRoute === '/(tabs)' && item.route === '/(tabs)');
          
          return (
          <TouchableOpacity
            key={index}
            style={[
              styles.menuItem,
              isActive && styles.activeMenuItem,
            ]}
            onPress={() => handleNavigation(item.route)}
          >
            <View style={styles.iconContainer}>{item.icon}</View>
            <Text
              style={[
                styles.menuItemText,
                isActive && styles.activeMenuItemText,
              ]}
            >
              {item.title}
            </Text>
          </TouchableOpacity>
          );
        })}
      </ScrollView>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>v1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
  },
  menuContainer: {
    flex: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activeMenuItem: {
    backgroundColor: colors.primary + "10",
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.text,
  },
  activeMenuItemText: {
    fontWeight: "600",
    color: colors.primary,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: colors.darkGray,
  },
});