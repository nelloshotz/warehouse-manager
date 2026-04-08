import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CostSettings } from "@/types/warehouse";
import { DEFAULT_COST_SETTINGS } from "@/constants/settings";

interface SettingsState {
  costSettings: CostSettings;
  updateCostSettings: (settings: Partial<CostSettings>) => void;
  exitColumns: number;
  addExitColumn: () => void;
  removeExitColumn: () => void;
}
// Costi predefiniti centralizzati in constants/settings.ts
 
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      costSettings: DEFAULT_COST_SETTINGS,
      updateCostSettings: (settings) =>
        set((state) => ({
          costSettings: { ...state.costSettings, ...settings },
        })),
      exitColumns: 11, // Numero predefinito di colonne di uscita
      addExitColumn: () =>
        set((state) => ({
          exitColumns: Math.min(state.exitColumns + 1, 20), // Massimo 20 colonne
        })),
      removeExitColumn: () =>
        set((state) => ({
          exitColumns: Math.max(state.exitColumns - 1, 1), // Minimo 1 colonna
        })),
    }),
    {
      name: "warehouse-settings",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);