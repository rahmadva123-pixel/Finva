import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// Simple client-side cache for Firestore documents using localStorage.
// TTL defaults to 5 minutes. Safe fallback: if localStorage unavailable or on server, it performs direct getDoc.
export async function getCachedDoc(collectionName: string, docId: string, ttlMs = 5 * 60 * 1000) {
  if (typeof window === 'undefined' || !db) {
    try {
      const snap = await getDoc(doc(db, collectionName, docId));
      return snap.exists() ? snap.data() : null;
    } catch {
      return null;
    }
  }

  const key = `cache:${collectionName}/${docId}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.ts && Date.now() - parsed.ts < ttlMs) {
        return parsed.data;
      }
    }
  } catch (e) {
    // ignore localStorage errors
  }

  try {
    const snap = await getDoc(doc(db, collectionName, docId));
    const data = snap.exists() ? snap.data() : null;
    try {
      window.localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) {
      // ignore write errors
    }
    return data;
  } catch (e) {
    return null;
  }
}

export function invalidateCachedDoc(collectionName: string, docId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`cache:${collectionName}/${docId}`);
  } catch {}
}
