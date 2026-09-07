import { DownloadJobResponse, DownloadPayload, DownloadProgress, VideoInfo } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');

/**
 * Helper to perform fetch requests with consistent error handling
 */
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      let errorMessage = `Request failed with status ${res.status}`;
      try {
        const errorData = await res.json();
        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            errorMessage = errorData.detail.map((d: { msg?: string }) => d.msg || 'Validation error').join(', ');
          } else {
            errorMessage = errorData.detail;
          }
        }
      } catch {
        // Response was not JSON
      }
      throw new Error(errorMessage);
    }

    return await res.json();
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Network error or server unreachable');
  }
}

export const api = {
  /**
   * Fetch video metadata and available download formats
   */
  async getVideoInfo(url: string): Promise<VideoInfo> {
    return apiFetch<VideoInfo>('/api/video/info', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  },

  /**
   * Queue a download job
   */
  async startDownload(payload: DownloadPayload): Promise<DownloadJobResponse> {
    return apiFetch<DownloadJobResponse>('/api/download', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Check real-time progress of a download job
   */
  async getDownloadProgress(jobId: string): Promise<DownloadProgress> {
    return apiFetch<DownloadProgress>(`/api/download/${jobId}/progress`, {
      method: 'GET',
    });
  },

  /**
   * Construct absolute URL for downloading the finished file
   */
  getDownloadFileUrl(jobId: string): string {
    return `${API_BASE_URL}/api/download/${jobId}/file`;
  },
};
