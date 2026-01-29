import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Wrapper per lo storage che usa IndexedDB sul web (limite ~30MB+) 
 * e AsyncStorage su mobile (limite ~6MB)
 */
export const createStorage = () => {
  if (Platform.OS === 'web') {
    // Sul web, usa IndexedDB direttamente tramite un wrapper compatibile
    return {
      getItem: async (key: string): Promise<string | null> => {
        try {
          // Usa IndexedDB direttamente sul web
          return new Promise((resolve, reject) => {
            const request = indexedDB.open('warehouse-storage', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction(['store'], 'readonly');
              const store = transaction.objectStore('store');
              const getRequest = store.get(key);
              
              getRequest.onerror = () => reject(getRequest.error);
              getRequest.onsuccess = () => {
                resolve(getRequest.result || null);
              };
            };
            
            request.onupgradeneeded = (event: any) => {
              const db = event.target.result;
              if (!db.objectStoreNames.contains('store')) {
                db.createObjectStore('store');
              }
            };
          });
        } catch (error) {
          console.error('Errore lettura storage:', error);
          return null;
        }
      },
      setItem: async (key: string, value: string): Promise<void> => {
        try {
          return new Promise((resolve, reject) => {
            const request = indexedDB.open('warehouse-storage', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction(['store'], 'readwrite');
              const store = transaction.objectStore('store');
              const putRequest = store.put(value, key);
              
              putRequest.onerror = () => {
                if (putRequest.error?.name === 'QuotaExceededError') {
                  reject(new Error('Quota storage superata (limite ~30MB). Cancella alcuni dati vecchi.'));
                } else {
                  reject(putRequest.error);
                }
              };
              putRequest.onsuccess = () => resolve();
            };
            
            request.onupgradeneeded = (event: any) => {
              const db = event.target.result;
              if (!db.objectStoreNames.contains('store')) {
                db.createObjectStore('store');
              }
            };
          });
        } catch (error: any) {
          if (error?.name === 'QuotaExceededError' || error?.message?.includes('Quota')) {
            throw new Error('Quota storage superata (limite ~30MB). Cancella alcuni dati vecchi.');
          }
          throw error;
        }
      },
      removeItem: async (key: string): Promise<void> => {
        try {
          return new Promise((resolve, reject) => {
            const request = indexedDB.open('warehouse-storage', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction(['store'], 'readwrite');
              const store = transaction.objectStore('store');
              const deleteRequest = store.delete(key);
              
              deleteRequest.onerror = () => reject(deleteRequest.error);
              deleteRequest.onsuccess = () => resolve();
            };
            
            request.onupgradeneeded = (event: any) => {
              const db = event.target.result;
              if (!db.objectStoreNames.contains('store')) {
                db.createObjectStore('store');
              }
            };
          });
        } catch (error) {
          console.error('Errore rimozione storage:', error);
        }
      },
    };
  } else {
    // Su mobile, usa AsyncStorage
    return AsyncStorage;
  }
};

