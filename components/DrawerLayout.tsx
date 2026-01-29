import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Animated, TouchableOpacity, Platform } from "react-native";
import { usePathname } from "expo-router";
import { colors } from "@/constants/colors";
import { Menu, X } from "lucide-react-native";
import SideDrawer from "./SideDrawer";
import { createShadowStyle } from "@/utils/shadowStyles";

interface DrawerLayoutProps {
  children: React.ReactNode;
}

const DRAWER_WIDTH = 280;

export default function DrawerLayout({ children }: DrawerLayoutProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pathname = usePathname();
  
  const toggleDrawer = () => {
    if (isDrawerOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  };
  
  const openDrawer = () => {
    setIsDrawerOpen(true);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.5,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };
  
  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -DRAWER_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsDrawerOpen(false);
    });
  };
  
  // Chiudi il drawer quando cambia la route
  useEffect(() => {
    if (isDrawerOpen) {
      closeDrawer();
    }
  }, [pathname]);
  
  // Gestisci il pulsante indietro su Android
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const backHandler = () => {
      if (isDrawerOpen) {
        closeDrawer();
        return true;
      }
      return false;
    };
    
    // Aggiungi il gestore del pulsante indietro
    // In un'app reale, utilizzerebbe BackHandler da react-native
    
    return () => {
      // Rimuovi il gestore del pulsante indietro
    };
  }, [isDrawerOpen]);
  
  return (
    <View style={styles.container}>
      {/* Contenuto principale */}
      <View style={styles.content}>
        {/* Header con pulsante menu */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.menuButton} onPress={toggleDrawer}>
            <Menu size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        
        {/* Contenuto dei figli */}
        <View style={styles.childrenContainer} pointerEvents="box-none">
          {children}
        </View>
      </View>
      
      {/* Overlay */}
      {isDrawerOpen && (
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: opacity,
            },
          ]}
          pointerEvents={isDrawerOpen ? "auto" : "none"}
        >
          <TouchableOpacity
            style={styles.overlayTouchable}
            onPress={closeDrawer}
            activeOpacity={1}
          />
        </Animated.View>
      )}
      
      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [{ translateX: translateX }],
          },
        ]}
      >
        <View style={styles.drawerHeader}>
          <TouchableOpacity style={styles.closeButton} onPress={closeDrawer}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <SideDrawer onClose={closeDrawer} currentRoute={pathname} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    height: 60,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  childrenContainer: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 1,
  },
  overlayTouchable: {
    flex: 1,
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    height: "100%",
    backgroundColor: colors.card,
    zIndex: 2,
    ...createShadowStyle("#000", { width: 2, height: 0 }, 0.2, 5, 5),
  },
  drawerHeader: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
});