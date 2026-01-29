import { Platform, ViewStyle } from 'react-native';

/**
 * Converte le proprietà shadow di React Native in boxShadow per il web
 * Mantiene le proprietà shadow native per iOS/Android
 */
export const createShadowStyle = (
  shadowColor: string = '#000',
  shadowOffset: { width: number; height: number } = { width: 0, height: 2 },
  shadowOpacity: number = 0.1,
  shadowRadius: number = 4,
  elevation?: number
): ViewStyle => {
  if (Platform.OS === 'web') {
    // Per il web, usa boxShadow invece delle proprietà shadow*
    const offsetX = shadowOffset.width || 0;
    const offsetY = shadowOffset.height || 0;
    const blurRadius = shadowRadius || 0;
    const spreadRadius = 0;
    
    // Converte il colore con opacità
    const rgbaColor = hexToRgba(shadowColor, shadowOpacity);
    
    return {
      boxShadow: `${offsetX}px ${offsetY}px ${blurRadius}px ${spreadRadius}px ${rgbaColor}`,
    } as ViewStyle;
  } else {
    // Per iOS/Android, usa le proprietà shadow native
    const style: ViewStyle = {
      shadowColor,
      shadowOffset,
      shadowOpacity,
      shadowRadius,
    };
    
    // Aggiungi elevation per Android
    if (elevation !== undefined && Platform.OS === 'android') {
      style.elevation = elevation;
    }
    
    return style;
  }
}

/**
 * Converte un colore hex in rgba con opacità
 */
function hexToRgba(hex: string, opacity: number): string {
  // Rimuovi il # se presente
  hex = hex.replace('#', '');
  
  // Converte hex in RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

