// src/utils/db.js

const DB_NAME = 'QuranAppDB';
// Incremented to 3 to force re-fetch of data with Transliteration included
const DB_VERSION = 3; 

const STORES = {
  CHAPTERS: 'chapters',
  VERSES: 'verses' 
};

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject(`IndexedDB error: ${event.target.error}`);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const transaction = event.target.transaction;
      
      console.log(`[DB] Upgrading to v${DB_VERSION} - Clearing old cache...`);

      // Clear old data so we fetch new data containing transliteration
      if (event.oldVersion > 0) {
         if (db.objectStoreNames.contains(STORES.VERSES)) {
             transaction.objectStore(STORES.VERSES).clear();
         }
         if (db.objectStoreNames.contains(STORES.CHAPTERS)) {
             transaction.objectStore(STORES.CHAPTERS).clear();
         }
      }
      
      if (!db.objectStoreNames.contains(STORES.CHAPTERS)) {
        db.createObjectStore(STORES.CHAPTERS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORES.VERSES)) {
        db.createObjectStore(STORES.VERSES, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
  });
};

export const getFromDB = async (storeName, key) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return null;
  }
};

export const saveToDB = async (storeName, key, data) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put({ key, data });
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return false;
  }
};

export const fetchWithCache = async (storeName, key, networkFetcher) => {
    try {
        const cached = await getFromDB(storeName, key);
        if (cached && cached.data) {
            console.log(`[Cache Hit] ${storeName} : ${key}`);
            return cached.data; 
        }
    } catch (e) {
        console.warn("Cache check failed", e);
    }

    console.log(`Fetching from API: ${key}`);
    const data = await networkFetcher();

    if (data) {
        saveToDB(storeName, key, data).catch(e => console.error("Cache save failed", e));
    }

    return data;
};

export const DB_STORES = STORES;