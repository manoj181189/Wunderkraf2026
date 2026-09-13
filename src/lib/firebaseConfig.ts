export interface FirebaseAppConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId?: string;
  appId?: string;
}

/**
 * Live Firebase Console Credentials for Wunderkraf ERP Real-Time Synchronization.
 * Configured for seamless cross-device synchronization on GitHub Pages, mobile, and desktop.
 */
export const firebaseConfig: FirebaseAppConfig = {
  projectId: "gen-lang-client-0537045708",
  apiKey: "AIzaSyCN8QKBkKe4xpSefupVTS9PDCuBNitBYUoQ",
  authDomain: "gen-lang-client-0537045708.firebaseapp.com",
  storageBucket: "gen-lang-client-0537045708.firebasestorage.app",
  messagingSenderId: "495943081360",
  appId: "1:495943081360:web:53e249ecf2a9897539a715"
};

export default firebaseConfig;
