import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CostSettings } from "@/types/warehouse";

interface SettingsState {
  costSettings: CostSettings;
  updateCostSettings: (settings: Partial<CostSettings>) => void;
  exitColumns: number;
  addExitColumn: () => void;
  removeExitColumn: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      costSettings: {
        costo_ingresso: 3.5,
        costo_uscita: 3.5,
        costo_storage: 0.233333,
        costo_congelato: 5.0,
      },
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