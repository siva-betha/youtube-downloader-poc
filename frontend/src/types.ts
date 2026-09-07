export interface FormatInfo {
  format_id: string;
  extension: string;
  resolution?: string | null;
  fps?: number | null;
  filesize?: number | null;
  type: 'video' | 'audio';
}

export interface VideoInfo {
  id: string;
  title: string;
  channel: string;
  duration?: number | null;
  duration_formatted?: string | null;
  thumbnail?: string | null;
  formats: FormatInfo[];
}

export interface DownloadPayload {
  url: string;
  format_id: string;
  download_type: 'video' | 'audio';
  quality?: string | null;
}

export interface DownloadJobResponse {
  job_id: string;
}

export type JobStatus = 'queued' | 'downloading' | 'processing' | 'completed' | 'failed';

export interface DownloadProgress {
  job_id: string;
  status: JobStatus;
  progress: number;
  downloaded_bytes?: number | null;
  total_bytes?: number | null;
  speed?: string | null;
  eta?: string | null;
  filename?: string | null;
  download_url?: string | null;
  error?: string | null;
}

export type AppState = 'idle' | 'analyzing' | 'ready' | 'downloading' | 'completed' | 'error';
