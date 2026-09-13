/**
 * Google Drive Integration Client Utilities
 * Handles Google Identity Services Token Client & Google Drive REST API v3
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id?: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient: any = null;
let currentAccessToken: string | null = null;

export function getStoredDriveToken(): string | null {
  if (currentAccessToken) return currentAccessToken;
  return localStorage.getItem('wk_gdrive_access_token');
}

export function setStoredDriveToken(token: string | null) {
  currentAccessToken = token;
  if (token) {
    localStorage.setItem('wk_gdrive_access_token', token);
  } else {
    localStorage.removeItem('wk_gdrive_access_token');
  }
}

/**
 * Initiates Google OAuth Token flow via Google Identity Services
 */
export async function authenticateGoogleDrive(): Promise<string> {
  return new Promise((resolve, reject) => {
    // If token already stored and valid
    const existing = getStoredDriveToken();
    if (existing) {
      resolve(existing);
      return;
    }

    if (typeof window === 'undefined') {
      reject(new Error('Window not available'));
      return;
    }

    // Check if GIS script loaded
    if (!window.google?.accounts?.oauth2) {
      // Dynamic load GIS script if not present
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setupAndRequestToken(resolve, reject);
      };
      script.onerror = () => {
        reject(new Error('Failed to load Google Identity Services library.'));
      };
      document.head.appendChild(script);
    } else {
      setupAndRequestToken(resolve, reject);
    }
  });
}

function setupAndRequestToken(resolve: (token: string) => void, reject: (err: any) => void) {
  try {
    // In AI Studio / Google Cloud environment, client_id is resolved or can be prompted
    tokenClient = window.google?.accounts.oauth2.initTokenClient({
      client_id: '495943081360-placeholder.apps.googleusercontent.com',
      scope: DRIVE_SCOPES,
      callback: (res) => {
        if (res.error) {
          reject(new Error(res.error));
          return;
        }
        if (res.access_token) {
          setStoredDriveToken(res.access_token);
          resolve(res.access_token);
        } else {
          reject(new Error('No access token received'));
        }
      }
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  } catch (err) {
    reject(err);
  }
}

/**
 * Uploads a file (JSON or CSV) to Google Drive
 */
export async function uploadFileToDrive(
  fileName: string,
  content: string,
  mimeType: string = 'application/json',
  token?: string
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const accessToken = token || getStoredDriveToken();
  if (!accessToken) {
    throw new Error('Google Drive access token missing. Please authenticate first.');
  }

  const metadata = {
    name: fileName,
    mimeType: mimeType,
    description: 'Backup from Wünderkraf Paperware Factory ERP'
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelimiter;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 401) {
      setStoredDriveToken(null);
    }
    throw new Error(`Google Drive API error (${response.status}): ${errText}`);
  }

  return response.json();
}

/**
 * Lists backed up ERP files from Google Drive
 */
export async function listDriveBackups(token?: string): Promise<Array<{ id: string; name: string; createdTime: string }>> {
  const accessToken = token || getStoredDriveToken();
  if (!accessToken) return [];

  const q = "name contains 'Wunderkraf' or name contains 'wunderkraf' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime)&orderBy=createdTime desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    if (res.status === 401) setStoredDriveToken(null);
    return [];
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Downloads a file content from Google Drive
 */
export async function downloadFileFromDrive(fileId: string, token?: string): Promise<string> {
  const accessToken = token || getStoredDriveToken();
  if (!accessToken) throw new Error('Not authenticated');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error(`Failed to download file from Google Drive: ${res.statusText}`);
  }

  return res.text();
}
