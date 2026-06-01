import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeProductName, sanitizeProductName } from "@/utils/rawMaterialsReport";

const defaultProductsData = require("@/prodotti.json") as { prodotti: string[] };

const DEFAULT_PRODUCTS: string[] = Array.isArray(defaultProductsData.prodotti)
  ? [...defaultProductsData.prodotti]
  : [];

interface RawMaterialsProductsState {
  products: string[];
  addProduct: (name: string) => { ok: boolean; error?: string };
  removeProduct: (name: string) => void;
}

export const useRawMaterialsProductsStore = create<RawMaterialsProductsState>()(
  persist(
    (set, get) => ({
      products: DEFAULT_PRODUCTS,
      addProduct: (name) => {
        const cleaned = sanitizeProductName(name);
        if (!cleaned) {
          return { ok: false, error: "Inserisci un nome prodotto." };
        }

        const normalizedNew = normalizeProductName(cleaned);
        const exists = get().products.some(
          (product) => normalizeProductName(product) === normalizedNew
        );
        if (exists) {
          return { ok: false, error: "Questo prodotto è già presente nell'elenco." };
        }

        set((state) => ({ products: [...state.products, cleaned] }));
        return { ok: true };
      },
      removeProduct: (name) => {
        set((state) => ({
          products: state.products.filter((product) => product !== name),
        }));
      },
    }),
    {
      name: "raw-materials-products",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: unknown) => {
        const state = persistedState as RawMaterialsProductsState | undefined;
        if (!state || !Array.isArray(state.products) || state.products.length === 0) {
          return { products: DEFAULT_PRODUCTS };
        }
        return state;
      },
    }
  )
);
