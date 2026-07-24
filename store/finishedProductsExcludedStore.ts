import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeProductName, sanitizeProductName } from "@/utils/finishedProductsReport";

interface FinishedProductsExcludedState {
  excludedProducts: string[];
  addProduct: (name: string) => { ok: boolean; error?: string };
  removeProduct: (name: string) => void;
}

export const useFinishedProductsExcludedStore = create<FinishedProductsExcludedState>()(
  persist(
    (set, get) => ({
      excludedProducts: [],
      addProduct: (name) => {
        const cleaned = sanitizeProductName(name);
        if (!cleaned) {
          return { ok: false, error: "Inserisci un nome prodotto." };
        }

        const normalizedNew = normalizeProductName(cleaned);
        const exists = get().excludedProducts.some(
          (product) => normalizeProductName(product) === normalizedNew
        );
        if (exists) {
          return { ok: false, error: "Questo prodotto è già presente nell'elenco." };
        }

        set((state) => ({ excludedProducts: [...state.excludedProducts, cleaned] }));
        return { ok: true };
      },
      removeProduct: (name) => {
        set((state) => ({
          excludedProducts: state.excludedProducts.filter((product) => product !== name),
        }));
      },
    }),
    {
      name: "finished-products-excluded",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);
