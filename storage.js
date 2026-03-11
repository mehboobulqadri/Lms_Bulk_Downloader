/* storage.js — IndexedDB job store (replaces chrome.storage.local, no quota) */
"use strict";

const _DB_NAME = "lmsDownloader";
const _DB_VER = 1;
const _STORE = "jobs";
const _JOB_KEY = "active";

/** @returns {Promise<IDBDatabase>} */
function _openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_DB_NAME, _DB_VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore(_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** @param {string} mode @returns {Promise<IDBObjectStore>} */
async function _store(mode) {
  const db = await _openDB();
  return db.transaction(_STORE, mode).objectStore(_STORE);
}

/** @param {object} job */
async function saveJob(job) {
  const store = await _store("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.put(job, _JOB_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** @returns {Promise<object|undefined>} */
async function loadJob() {
  const store = await _store("readonly");
  return new Promise((resolve, reject) => {
    const req = store.get(_JOB_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function clearJob() {
  const store = await _store("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.delete(_JOB_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

window.JobStorage = { saveJob, loadJob, clearJob };
