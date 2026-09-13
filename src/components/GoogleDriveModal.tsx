import React, { useState, useEffect } from 'react';
import { Cloud, Upload, Download, RefreshCw, CheckCircle2, AlertCircle, FileText, X, ExternalLink } from 'lucide-react';
import {
  authenticateGoogleDrive,
  uploadFileToDrive,
  listDriveBackups,
  downloadFileFromDrive,
  getStoredDriveToken,
  setStoredDriveToken
} from '../lib/googleDrive';
import { FactoryState } from '../types';
import { downloadCSV, downloadJSON, generateDailySummaryCSV } from '../lib/utils';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  factoryState: FactoryState;
  onRestoreState: (state: FactoryState) => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  factoryState,
  onRestoreState
}) => {
  const [hasToken, setHasToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string; createdTime: string }>>([]);

  useEffect(() => {
    if (isOpen) {
      const token = getStoredDriveToken();
      setHasToken(!!token);
      if (token) {
        fetchDriveFiles(token);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const fetchDriveFiles = async (token?: string) => {
    try {
      const files = await listDriveBackups(token);
      setDriveFiles(files);
    } catch (e) {
      console.warn('Could not list drive files:', e);
    }
  };

  const handleConnectDrive = async () => {
    setIsLoading(true);
    setStatusMessage({ type: 'info', text: 'Connecting to Google Drive...' });
    try {
      const token = await authenticateGoogleDrive();
      setHasToken(true);
      setStatusMessage({ type: 'success', text: 'Connected to Google Drive successfully!' });
      await fetchDriveFiles(token);
    } catch (err: any) {
      console.error('Google Drive auth error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Could not complete Google Drive authorization. You can still use local download.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadJsonToDrive = async () => {
    setIsLoading(true);
    setStatusMessage({ type: 'info', text: 'Uploading ERP state JSON to Google Drive...' });
    try {
      const token = getStoredDriveToken();
      if (!token) {
        await handleConnectDrive();
      }

      const fileName = `Wunderkraf_Master_ERP_Backup_${new Date().toISOString().split('T')[0]}_${Date.now().toString().slice(-4)}.json`;
      const jsonContent = JSON.stringify(factoryState, null, 2);

      const res = await uploadFileToDrive(fileName, jsonContent, 'application/json');
      setStatusMessage({
        type: 'success',
        text: `Uploaded "${fileName}" to your Google Drive! (ID: ${res.id})`
      });
      await fetchDriveFiles();
    } catch (err: any) {
      console.error('Upload to Drive failed:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to upload to Google Drive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadCsvToDrive = async () => {
    setIsLoading(true);
    setStatusMessage({ type: 'info', text: 'Uploading Executive CSV report to Google Drive...' });
    try {
      const fileName = `Wunderkraf_Production_Report_${new Date().toISOString().split('T')[0]}.csv`;
      const csvContent = generateDailySummaryCSV(factoryState);

      const res = await uploadFileToDrive(fileName, csvContent, 'text/csv');
      setStatusMessage({
        type: 'success',
        text: `Uploaded CSV "${fileName}" to Google Drive! (ID: ${res.id})`
      });
      await fetchDriveFiles();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to upload CSV to Google Drive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreFromDrive = async (fileId: string) => {
    if (!confirm('Are you sure you want to restore the factory state from this Google Drive backup? Current unsaved work will be replaced.')) return;
    setIsLoading(true);
    try {
      const content = await downloadFileFromDrive(fileId);
      const parsed = JSON.parse(content);
      onRestoreState(parsed);
      setStatusMessage({ type: 'success', text: 'Restored factory state from Google Drive successfully!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Failed to restore backup: ' + (err.message || 'Invalid format') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    setStoredDriveToken(null);
    setHasToken(false);
    setDriveFiles([]);
    setStatusMessage({ type: 'info', text: 'Disconnected Google Drive account.' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-rose-600 p-1 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#1a365d] m-0">Google Drive Cloud Synchronization</h3>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                drive.file
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Securely backup & restore production databases directly to your Google Workspace Drive
            </p>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs font-medium flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Auth / Connection State */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs font-bold text-slate-700">Google Drive Connection</div>
              <div className="text-xs text-slate-500">
                {hasToken ? 'Connected with drive.file OAuth permissions' : 'Not connected yet'}
              </div>
            </div>

            {hasToken ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </span>
                <button
                  onClick={handleDisconnect}
                  className="text-xs text-slate-500 hover:text-rose-600 underline cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectDrive}
                disabled={isLoading}
                className="px-3.5 py-1.5 bg-[#4285F4] hover:bg-[#3367d6] text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Cloud className="w-3.5 h-3.5" /> Connect Google Drive
              </button>
            )}
          </div>
        </div>

        {/* Primary Backup Action Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl">
            <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wide m-0 mb-1">
              1. Cloud Drive Backup
            </h4>
            <p className="text-[11px] text-blue-700 mb-3">
              Upload full state JSON (Jobs, Logs, Orders, Scrap) directly into Google Drive
            </p>
            <div className="space-y-1.5">
              <button
                onClick={handleUploadJsonToDrive}
                disabled={isLoading}
                className="w-full py-2 bg-[#2b6cb0] hover:bg-[#1a365d] text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" /> Save JSON to Drive
              </button>
              <button
                onClick={handleUploadCsvToDrive}
                disabled={isLoading}
                className="w-full py-2 bg-[#2f855a] hover:bg-[#276749] text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5" /> Save CSV to Drive
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide m-0 mb-1">
              2. Local Offline Fallback
            </h4>
            <p className="text-[11px] text-slate-500 mb-3">
              Directly download backup files onto your computer disk without Google Drive
            </p>
            <div className="space-y-1.5">
              <button
                onClick={() =>
                  downloadJSON(factoryState, `Wunderkraf_Master_Backup_${new Date().toISOString().split('T')[0]}.json`)
                }
                className="w-full py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download Local JSON
              </button>
              <button
                onClick={() =>
                  downloadCSV(
                    generateDailySummaryCSV(factoryState),
                    `Wunderkraf_Daily_Summary_${new Date().toISOString().split('T')[0]}.csv`
                  )
                }
                className="w-full py-2 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" /> Download Local CSV
              </button>
            </div>
          </div>
        </div>

        {/* Existing Drive Backups List */}
        {driveFiles.length > 0 && (
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 mb-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide m-0 mb-2">
              Recent ERP Backups on Google Drive
            </h4>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {driveFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg text-xs"
                >
                  <div className="truncate mr-2">
                    <div className="font-bold text-slate-800 truncate">{file.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {file.createdTime ? new Date(file.createdTime).toLocaleString() : 'Recent'}
                    </div>
                  </div>
                  {file.name.endsWith('.json') && (
                    <button
                      onClick={() => handleRestoreFromDrive(file.id)}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded flex-shrink-0 cursor-pointer"
                    >
                      Restore
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Restore from Local JSON File Upload */}
        <div className="border-t border-slate-100 pt-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-xs font-bold text-slate-700">Restore from Local File</div>
            <div className="text-[11px] text-slate-400">Select a previously saved .json backup file</div>
          </div>
          <div>
            <input
              type="file"
              id="local-restore-input"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const data = JSON.parse(ev.target?.result as string);
                      onRestoreState(data);
                      setStatusMessage({ type: 'success', text: 'Restored state from local file!' });
                    } catch (err) {
                      setStatusMessage({ type: 'error', text: 'Invalid JSON backup file.' });
                    }
                  };
                  reader.readAsText(file);
                }
              }}
            />
            <button
              onClick={() => document.getElementById('local-restore-input')?.click()}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition cursor-pointer"
            >
              Choose .JSON File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
