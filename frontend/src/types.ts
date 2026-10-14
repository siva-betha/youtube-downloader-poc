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

// ─── Channel Types ────────────────────────────────────────────────────────────

export interface ChannelVideoItem {
  id: string;
  title: string;
  url: string;
  thumbnail?: string | null;
  duration?: number | null;
  duration_formatted?: string | null;
  view_count?: number | null;
  upload_date?: string | null;
}

export interface ChannelInfo {
  channel_id: string;
  channel_name: string;
  channel_url: string;
  thumbnail?: string | null;
  video_count: number;
  videos: ChannelVideoItem[];
}

/** Quality preset labels shown in the channel browser UI */
export type QualityPreset = 'best' | '1080p' | '720p' | '480p' | '360p' | 'audio';

/** Download mode chosen by the user before bulk download starts */
export type DownloadMode = 'sequential' | 'parallel';

/** Per-video state inside the download queue */
export interface ChannelDownloadItem {
  video: ChannelVideoItem;
  qualityOverride: QualityPreset | null; // null = use global quality
  jobId: string | null;
  status: 'pending' | JobStatus;
  progress: number;
  error?: string | null;
  fileUrl?: string | null;
}
