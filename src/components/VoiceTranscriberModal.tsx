import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, Copy, Check, Sparkles, X, Volume2 } from 'lucide-react';
import { AudioRecorder, transcribeAudio } from '../lib/audioRecorder';

interface VoiceTranscriberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTranscription?: (text: string) => void;
  initialPrompt?: string;
}

export const VoiceTranscriberModal: React.FC<VoiceTranscriberModalProps> = ({
  isOpen,
  onClose,
  onApplyTranscription,
  initialPrompt
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState(initialPrompt || '');

  const recorderRef = useRef<AudioRecorder | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (recorderRef.current) {
        recorderRef.current.cleanup();
        recorderRef.current = null;
      }
      setIsRecording(false);
      setDuration(0);
      setIsProcessing(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartRecording = async () => {
    try {
      setError(null);
      setTranscription('');
      const recorder = new AudioRecorder((sec) => setDuration(sec));
      recorderRef.current = recorder;
      await recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      setError(err.message || 'Microphone access denied or not available.');
    }
  };

  const handleStopRecording = async () => {
    if (!recorderRef.current) return;
    try {
      setIsRecording(false);
      setIsProcessing(true);
      setError(null);

      const { base64, mimeType } = await recorderRef.current.stop();
      recorderRef.current = null;

      const result = await transcribeAudio(
        base64,
        mimeType,
        customPrompt || 'Transcribe factory operator audio report clearly with accurate names, stage, machine numbers, and weights in KG or crates.'
      );

      setTranscription(result);
    } catch (err: any) {
      console.error('Transcription failed:', err);
      setError(err.message || 'Failed to transcribe audio. Please check network or API key.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (!transcription) return;
    navigator.clipboard.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (onApplyTranscription && transcription) {
      onApplyTranscription(transcription);
      onClose();
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const presets = [
    'Machine Breakdown Note',
    'Slitting Roll Output Weight',
    'Customer Packaging Instructions',
    'QC Rejection Cause'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-rose-600 p-1 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#1a365d] m-0">Voice Floor Dictation</h3>
              <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded">
                gemini-3.5-transcribe
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Record spoken notes, remarks, machine logs or operator observations
            </p>
          </div>
        </div>

        {/* Recording Center Stage */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center mb-4">
          <div className="flex justify-center mb-3">
            {isRecording ? (
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-rose-500/20 animate-ping absolute inset-0"></div>
                <button
                  onClick={handleStopRecording}
                  className="w-20 h-20 rounded-full bg-rose-600 text-white flex flex-col items-center justify-center relative z-10 shadow-lg hover:bg-rose-700 transition cursor-pointer active:scale-95"
                >
                  <Square className="w-7 h-7 fill-white" />
                  <span className="text-[10px] font-bold mt-1 uppercase">Stop</span>
                </button>
              </div>
            ) : isProcessing ? (
              <div className="w-20 h-20 rounded-full bg-purple-100 text-purple-700 flex flex-col items-center justify-center shadow-inner">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-[10px] font-bold mt-1">Transcribing...</span>
              </div>
            ) : (
              <button
                onClick={handleStartRecording}
                className="w-20 h-20 rounded-full bg-[#805ad5] text-white flex flex-col items-center justify-center shadow-lg hover:bg-[#6b46c1] transition cursor-pointer active:scale-95"
              >
                <Mic className="w-7 h-7" />
                <span className="text-[10px] font-bold mt-1 uppercase">Record</span>
              </button>
            )}
          </div>

          <div className="text-sm font-bold text-slate-700">
            {isRecording ? (
              <span className="text-rose-600 flex items-center justify-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                Recording: {formatTime(duration)}
              </span>
            ) : isProcessing ? (
              <span className="text-purple-700">Processing Audio with Gemini 3.5 Transcribe...</span>
            ) : (
              <span className="text-slate-500">Click Record & speak into your microphone</span>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg mb-4 font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Transcription Output */}
        {transcription && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
              <span className="flex items-center gap-1 text-purple-700">
                <Volume2 className="w-3.5 h-3.5" />
                Transcribed Audio Result:
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-[11px] cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <textarea
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              rows={3}
              className="w-full p-3 bg-slate-50 border border-purple-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-purple-400 outline-none"
            />
          </div>
        )}

        {/* Optional Context Prompt */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
            Dictation Context / Helper Preset:
          </label>
          <div className="flex flex-wrap gap-1 mb-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setCustomPrompt(`Extract clear details for: ${p}`)}
                className="text-[10px] bg-slate-100 hover:bg-purple-50 hover:text-purple-800 border border-slate-200 px-2 py-0.5 rounded text-slate-600 cursor-pointer"
              >
                {p}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="e.g. Focus on numbers in KG, operator names, breakdown cause"
            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            Close
          </button>
          {transcription && onApplyTranscription && (
            <button
              onClick={handleApply}
              className="px-4 py-2 text-xs font-bold bg-[#2b6cb0] hover:bg-[#1a365d] text-white rounded-lg transition shadow-xs cursor-pointer"
            >
              Insert into Form
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
