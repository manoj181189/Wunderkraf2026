export interface FirebaseAppConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId?: string;
  appId?: string;
}

/**
 * Isolated Development & Staging Environment
 * Live production Firebase credentials removed to guarantee zero impact on factory floor.
 */
export const firebaseConfig: FirebaseAppConfig = {
  projectId: "",
  apiKey: "",
  authDomain: "",
  storageBucket: ""
};

export default firebaseConfig;
