import { describe, expect, it } from 'vitest';
import {
  initFirebase,
  isConfigured,
  isFirebaseConfigured,
  readFirebaseConfig,
} from '../firebase';

describe('Firebase initialization and configuration', () => {
  it('reads config from an environment map', () => {
    const mockEnv = {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'globe-detective-test',
      VITE_FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
      VITE_FIREBASE_APP_ID: '1:123456:web:abcdef',
    };

    const config = readFirebaseConfig(mockEnv);
    expect(config.apiKey).toBe('test-api-key');
    expect(config.authDomain).toBe('test.firebaseapp.com');
    expect(config.projectId).toBe('globe-detective-test');
    expect(config.storageBucket).toBe('test.appspot.com');
    expect(config.messagingSenderId).toBe('123456789');
    expect(config.appId).toBe('1:123456:web:abcdef');
  });

  it('determines if minimum Firebase credentials are provided', () => {
    expect(isFirebaseConfigured({})).toBe(false);
    expect(isFirebaseConfigured({ apiKey: 'key-only' })).toBe(false);
    expect(isFirebaseConfigured({ projectId: 'project-only' })).toBe(false);
    expect(isFirebaseConfigured({ apiKey: 'key', projectId: 'project' })).toBe(true);
  });

  it('initFirebase returns unconfigured services when credentials are missing', () => {
    const services = initFirebase({ apiKey: undefined, projectId: undefined }, 'unconfigured-test-app');
    expect(services.configured).toBe(false);
    expect(services.app).toBeNull();
    expect(services.auth).toBeNull();
    expect(services.db).toBeNull();
    expect(services.functions).toBeNull();
  });

  it('default singleton exports are safe to import in Guest Mode', () => {
    expect(typeof isConfigured).toBe('boolean');
    // In test environment without .env set, it defaults to unconfigured guest mode
    if (!isConfigured) {
      expect(initFirebase().app).toBeNull();
    }
  });
});
