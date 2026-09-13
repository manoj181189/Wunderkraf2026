/**
 * Audio Recording and Speech-To-Text API Client
 * Connects microphone input to Google GenAI gemini-3.5-transcribe model
 */

export interface RecordingState {
  isRecording: boolean;
  durationSeconds: number;
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private timer: number | null = null;
  private durationSeconds = 0;
  private onDurationUpdate?: (sec: number) => void;

  constructor(onDurationUpdate?: (sec: number) => void) {
    this.onDurationUpdate = onDurationUpdate;
  }

  async start(): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone access is not supported in this browser.');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioChunks = [];
    this.durationSeconds = 0;

    let mimeType = 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    }

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250); // Slice every 250ms

    this.timer = window.setInterval(() => {
      this.durationSeconds++;
      if (this.onDurationUpdate) {
        this.onDurationUpdate(this.durationSeconds);
      }
    }, 1000);
  }

  async stop(): Promise<{ blob: Blob; mimeType: string; base64: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder was not started'));
        return;
      }

      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(this.audioChunks, { type: mimeType });

          // Convert blob to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const resultStr = reader.result as string;
            // Strip data url prefix
            const base64Data = resultStr.split(',')[1] || resultStr;
            resolve({
              blob,
              mimeType: mimeType.split(';')[0],
              base64: base64Data
            });
          };
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(blob);

          // Stop all tracks
          if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
          }
        } catch (e) {
          reject(e);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  cleanup() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}

/**
 * Sends audio to backend transcription service
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string = 'audio/webm',
  customPrompt?: string
): Promise<string> {
  const response = await fetch('/api/ai/transcribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      audioBase64,
      mimeType,
      prompt: customPrompt
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Transcription failed' }));
    throw new Error(err.error || `Server responded with ${response.status}`);
  }

  const data = await response.json();
  return data.transcription || '';
}
