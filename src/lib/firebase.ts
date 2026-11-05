import { getApps, initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import type { Functions } from 'firebase/functions';

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

/** Reads public Firebase environment variables (VITE_FIREBASE_*). */
export function readFirebaseConfig(env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>): FirebaseConfig {
  return {
    apiKey: env.VITE_FIREBASE_API_KEY?.trim() || undefined,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || undefined,
    projectId: env.VITE_FIREBASE_PROJECT_ID?.trim() || undefined,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || undefined,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined,
    appId: env.VITE_FIREBASE_APP_ID?.trim() || undefined,
  };
}

/** Returns true if minimum credentials required to initialize Firebase are present. */
export function isFirebaseConfigured(config: FirebaseConfig = readFirebaseConfig()): boolean {
  return Boolean(config.apiKey && config.projectId);
}

export interface FirebaseServices {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
  functions: Functions | null;
  configured: boolean;
}

/** Initializes Firebase services or returns null handles if unconfigured/failed. */
export function initFirebase(config: FirebaseConfig = readFirebaseConfig(), appName = '[DEFAULT]'): FirebaseServices {
  if (!isFirebaseConfigured(config)) {
    return { app: null, auth: null, db: null, functions: null, configured: false };
  }

  try {
    const existing = getApps().find((a) => a.name === appName);
    const app = existing ?? initializeApp(config as Record<string, string>, appName);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const functions = getFunctions(app);
    return { app, auth, db, functions, configured: true };
  } catch (err) {
    console.warn('Firebase initialization failed; falling back to local guest mode:', err);
    return { app: null, auth: null, db: null, functions: null, configured: false };
  }
}

// Default singleton instance initialized with environment variables
const services = initFirebase();

export const app = services.app;
export const auth = services.auth;
export const db = services.db;
export const functions = services.functions;
export const isConfigured = services.configured;
