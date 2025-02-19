// /**
//  * Use IndexedDB for local storage.
//  * Based on https://github.com/DVLP/localStorageDB, but converted to TypeScript and using async instead of callbacks.
//  * @source: https://github.com/DVLP/localStorageDB/blob/master/localdata.js
//  *
//  * Usage example
//  *
//  *
// ```ts
// const test = async () => {
//   ldb.set('nameGoesHere', 'value goes here');
//   ldb.set('nameGoesHere2', 'value 2 goes here');

//   const asyncValue = await ldb.get('nameGoesHere');
//   console.log('And the async value is', asyncValue);
//   console.log('List of keys', await ldb.list());
//   console.log('All values', await ldb.getAll());

//   // Deleting one value
//   await ldb.delete('nameGoesHere');
//   const asyncValue2 = await ldb.get('nameGoesHere');
//   console.log('And the async value after delete is', asyncValue2);
//   console.log('All values', await ldb.getAll());

//   // Clear everything
//   console.log('Storage cleared', await ldb.clear());
//   console.log('All values', await ldb.getAll());
// };
// test();
// ```
//  */

const dbFact = () => {
  {
    const win = typeof window !== 'undefined' ? window : undefined;
    if (!win) {
      throw new Error('indexedDB cannot get window');
    }
    const indexedDB =
      win.indexedDB ||
      (win as any).mozIndexedDB ||
      (win as any).webkitIndexedDB ||
      (win as any).msIndexedDB;
    if (typeof window !== 'undefined' && !indexedDB) {
      throw new Error('indexDB not supported');
    }
    let db: IDBDatabase | null;
    const request = indexedDB.open('ldb', 1);
    request.onsuccess = function () {
      db = this.result;
    };
    request.onerror = (event: Event) => {
      console.error('indexedDB request error');
      console.error(event);
    };

    request.onupgradeneeded = function (event: IDBVersionChangeEvent) {
      db = null;
      const store =
        event &&
        event.target &&
        (event.target as any).result.createObjectStore('s', {
          keyPath: 'k',
        });

      store.transaction.oncomplete = function (e: Event) {
        db = (e.target as any).db as IDBDatabase;
      };
    };

    const localDb = {
      get: (key: string) =>
        new Promise<string>((resolve) => {
          if (!db) {
            setTimeout(async () => resolve(await localDb.get(key)), 50);
            return;
          }
          db.transaction('s').objectStore('s').get(key).onsuccess = function (
            event
          ) {
            const result =
              ((event.target as any).result &&
                (event.target as any).result['v']) ||
              null;
            resolve(result);
          };
        }),
      set: (key: string, value: string) =>
        new Promise<void>((resolve) => {
          if (!db) {
            setTimeout(async () => resolve(await localDb.set(key, value)), 50);
            return;
          }
          let txn = db.transaction('s', 'readwrite');
          txn.oncomplete = () => resolve();
          txn.objectStore('s').put({
            k: key,
            v: value,
          });
          txn.commit();
        }),
      delete: (key: string) =>
        new Promise<void>((resolve) => {
          if (!db) {
            setTimeout(async () => resolve(await localDb.delete(key)), 50);
            return;
          }
          db
            .transaction('s', 'readwrite')
            .objectStore('s')
            .delete(key).onsuccess = function () {
            resolve();
          };
        }),
      list: () =>
        new Promise<string[]>((resolve) => {
          if (!db) {
            setTimeout(async () => resolve(await localDb.list()), 50);
            return;
          }
          db.transaction('s').objectStore('s').getAllKeys().onsuccess = (
            event
          ) => {
            const result = (event.target as any).result || null;
            resolve(result);
          };
        }),
      getAll: () =>
        new Promise<Array<{ k: string; v: string }>>((resolve) => {
          if (!db) {
            setTimeout(async () => resolve(await localDb.getAll()), 50);
            return;
          }
          db.transaction('s').objectStore('s').getAll().onsuccess = (event) => {
            const result = ((event.target as any).result as any) || null;
            resolve(result);
          };
        }),
      clear: () =>
        new Promise<void>((resolve) => {
          if (!db) {
            setTimeout(async () => resolve(await localDb.clear()), 50);
            return;
          }
          db.transaction('s', 'readwrite').objectStore('s').clear().onsuccess =
            () => {
              resolve();
            };
        }),
    };
    return localDb;
    // ldb = localDb;
  }
};

export const ldb = dbFact();

// (function () {
//   const win = typeof window !== 'undefined' ? window : undefined;
//   if (!win) {
//     console.error('indexedDB cannot get window');
//     return;
//   }
//   const indexedDB =
//     win.indexedDB ||
//     (win as any).mozIndexedDB ||
//     (win as any).webkitIndexedDB ||
//     (win as any).msIndexedDB;
//   if (typeof window !== 'undefined' && !indexedDB) {
//     console.error('indexDB not supported');
//     return;
//   }
//   let db: IDBDatabase | null;
//   const request = indexedDB.open('ldb', 1);
//   request.onsuccess = function () {
//     db = this.result;
//   };
//   request.onerror = (event: Event) => {
//     console.error('indexedDB request error');
//     console.log(event);
//   };

//   request.onupgradeneeded = function (event: IDBVersionChangeEvent) {
//     db = null;
//     const store =
//       event &&
//       event.target &&
//       (event.target as any).result.createObjectStore('s', {
//         keyPath: 'k',
//       });

//     store.transaction.oncomplete = function (e: Event) {
//       db = (e.target as any).db as IDBDatabase;
//     };
//   };

//   const localDb = {
//     get: (key: string) =>
//       new Promise<string>((resolve) => {
//         if (!db) {
//           setTimeout(async () => resolve(await localDb.get(key)), 50);
//           return;
//         }
//         db.transaction('s').objectStore('s').get(key).onsuccess = function (event) {
//           const result =
//             ((event.target as any).result && (event.target as any).result['v']) || null;
//           resolve(result);
//         };
//       }),
//     set: (key: string, value: string) =>
//       new Promise<void>((resolve) => {
//         if (!db) {
//           setTimeout(async () => resolve(await localDb.set(key, value)), 50);
//           return;
//         }
//         let txn = db.transaction('s', 'readwrite');
//         txn.oncomplete = () => resolve();
//         txn.objectStore('s').put({
//           k: key,
//           v: value,
//         });
//         txn.commit();
//       }),
//     delete: (key: string) =>
//       new Promise<void>((resolve) => {
//         if (!db) {
//           setTimeout(async () => resolve(await localDb.delete(key)), 50);
//           return;
//         }
//         db.transaction('s', 'readwrite').objectStore('s').delete(key).onsuccess = function () {
//           resolve();
//         };
//       }),
//     list: () =>
//       new Promise<string[]>((resolve) => {
//         if (!db) {
//           setTimeout(async () => resolve(await localDb.list()), 50);
//           return;
//         }
//         db.transaction('s').objectStore('s').getAllKeys().onsuccess = (event) => {
//           const result = (event.target as any).result || null;
//           resolve(result);
//         };
//       }),
//     getAll: () =>
//       new Promise<Array<{ k: string; v: string }>>((resolve) => {
//         if (!db) {
//           setTimeout(async () => resolve(await localDb.getAll()), 50);
//           return;
//         }
//         db.transaction('s').objectStore('s').getAll().onsuccess = (event) => {
//           const result = ((event.target as any).result as any) || null;
//           resolve(result);
//         };
//       }),
//     clear: () =>
//       new Promise<void>((resolve) => {
//         if (!db) {
//           setTimeout(async () => resolve(await localDb.clear()), 50);
//           return;
//         }
//         db.transaction('s', 'readwrite').objectStore('s').clear().onsuccess = () => {
//           resolve();
//         };
//       }),
//   };
//   ldb = localDb;
// })();

// export let ldb: {
//   get: (key: string) => Promise<string>;
//   // get: (key: string, callback: (result: string) => void) => void;
//   set: (key: string, value: string) => Promise<void>;
//   // set: (key: string, value: string, callback?: () => void) => void;
//   delete: (key: string) => Promise<void>;
//   // delete: (key: string, callback: () => void) => void;
//   list: () => Promise<string[]>;
//   // list: (callback: (listOfKeys: string[]) => void) => void;
//   getAll: () => Promise<Array<{ k: string; v: string }>>;
//   // getAll: (callback: (allEntries: Array<{ k: string; v: string }>) => void) => void;
//   clear: () => Promise<void>;
//   // clear: (callback: () => void) => void;
// };
