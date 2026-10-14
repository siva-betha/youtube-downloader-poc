import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Youtube, Sparkles, ShieldCheck, Tv2 } from 'lucide-react';
import { UrlInput } from './components/UrlInput';
import { VideoInfo } from './components/VideoInfo';
import { FormatSelector } from './components/FormatSelector';
import { DownloadProgress } from './components/DownloadProgress';
import { ErrorMessage } from './components/ErrorMessage';
import { ChannelBrowser } from './components/ChannelBrowser';
import { DownloadQueue } from './components/DownloadQueue';
import { api } from './services/api';
import {
  AppState,
  ChannelDownloadItem,
  ChannelInfo,
  DownloadMode,
  DownloadProgress as DownloadProgressType,
  QualityPreset,
  VideoInfo as VideoInfoType,
} from './types';

// Map QualityPreset → yt-dlp format strings (prefer MP4 video + M4A audio for instant zero-transcode merging)
function qualityToFormatId(preset: QualityPreset): { format_id: string; type: 'video' | 'audio' } {
  switch (preset) {
    case 'audio':   return { format_id: 'bestaudio[ext=m4a]/bestaudio', type: 'audio' };
    case '1080p':   return { format_id: 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]', type: 'video' };
    case '720p':    return { format_id: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]', type: 'video' };
    case '480p':    return { format_id: 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]', type: 'video' };
    case '360p':    return { format_id: 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=360]+bestaudio/best[height<=360]', type: 'video' };
    default:        return { format_id: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best', type: 'video' };
  }
}

// ─── Main App ─────────────────────────────────────────────────────────────────

type ViewMode = 'video' | 'channel' | 'channel-queue';

export const App: React.FC = () => {
  // ── Shared state ──────────────────────────────────────────────────────────
  const [appState, setAppState] = useState<AppState>('idle');
  const [viewMode, setViewMode] = useState<ViewMode>('video');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Single-video state ────────────────────────────────────────────────────
  const [videoInfo, setVideoInfo] = useState<VideoInfoType | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressType | null>(null);
  const [downloadFileUrl, setDownloadFileUrl] = useState<string | null>(null);

  // ── Channel state ─────────────────────────────────────────────────────────
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [channelMaxVideos, setChannelMaxVideos] = useState<number | null>(20);
  const [isRefetchingChannel, setIsRefetchingChannel] = useState(false);
  const [downloadQueue, setDownloadQueue] = useState<ChannelDownloadItem[]>([]);

  const pollIntervalRef = useRef<number | null>(null);
  const channelPollsRef = useRef<Record<string, number>>({});

  // ── Polling helpers ───────────────────────────────────────────────────────
  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const stopAllChannelPolls = () => {
    Object.values(channelPollsRef.current).forEach(id => clearInterval(id));
    channelPollsRef.current = {};
  };

  useEffect(() => {
    return () => {
      stopPolling();
      stopAllChannelPolls();
    };
  }, []);

  // ── URL submission: auto-detect type then route ───────────────────────────
  const handleAnalyze = async (url: string) => {
    setErrorMessage(null);
    setCurrentUrl(url);
    setAppState('analyzing');
    setVideoInfo(null);
    setChannelInfo(null);

    try {
      const detection = await api.detectUrlType(url);

      if (detection.url_type === 'channel') {
        // Channel flow
        const data = await api.getChannelInfo(url, channelMaxVideos);
        setChannelInfo(data);
        setViewMode('channel');
        setAppState('ready');
      } else if (detection.url_type === 'video') {
        // Single video flow
        const data = await api.getVideoInfo(url);
        setVideoInfo(data);
        setViewMode('video');
        setAppState('ready');
      } else {
        setErrorMessage(
          'Unrecognized URL. Please paste a YouTube video URL (youtube.com/watch?v=...) or channel URL (youtube.com/@handle).'
        );
        setAppState('error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to analyze URL';
      setErrorMessage(msg);
      setAppState('error');
    }
  };

  // ── Channel refetch ───────────────────────────────────────────────────────
  const handleChannelRefetch = async (max: number | null) => {
    if (!currentUrl) return;
    setIsRefetchingChannel(true);
    setChannelMaxVideos(max);
    try {
      const data = await api.getChannelInfo(currentUrl, max);
      setChannelInfo(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reload channel';
      setErrorMessage(msg);
    } finally {
      setIsRefetchingChannel(false);
    }
  };

  // ── Single-video download ─────────────────────────────────────────────────
  const handleVideoDownload = async (formatId: string, type: 'video' | 'audio', quality?: string) => {
    if (!currentUrl) return;
    setErrorMessage(null);
    setAppState('downloading');

    try {
      const jobResponse = await api.startDownload({
        url: currentUrl,
        format_id: formatId,
        download_type: type,
        quality: quality || null,
      });

      const jobId = jobResponse.job_id;
      setDownloadFileUrl(api.getDownloadFileUrl(jobId));
      setDownloadProgress({ job_id: jobId, status: 'queued', progress: 0 });

      stopPolling();
      pollIntervalRef.current = window.setInterval(async () => {
        try {
          const progress = await api.getDownloadProgress(jobId);
          setDownloadProgress(progress);
          if (progress.status === 'completed') {
            stopPolling();
            setAppState('completed');
          } else if (progress.status === 'failed') {
            stopPolling();
            setAppState('error');
            setErrorMessage(progress.error || 'The download job failed.');
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start download';
      setErrorMessage(msg);
      setAppState('error');
    }
  };

  // ── Channel bulk download ─────────────────────────────────────────────────
  const handleChannelDownload = useCallback(async (
    selectedIds: string[],
    qualityOverrides: Record<string, QualityPreset | null>,
    globalQuality: QualityPreset,
    mode: DownloadMode,
  ) => {
    if (!channelInfo) return;

    const selectedVideos = channelInfo.videos.filter(v => selectedIds.includes(v.id));

    // Build initial queue
    const initialQueue: ChannelDownloadItem[] = selectedVideos.map(video => ({
      video,
      qualityOverride: qualityOverrides[video.id] ?? null,
      jobId: null,
      status: 'pending',
      progress: 0,
    }));

    setDownloadQueue(initialQueue);
    setViewMode('channel-queue');
    stopAllChannelPolls();

    // Helper: start one video download and poll it
    const downloadOne = async (item: ChannelDownloadItem, index: number) => {
      const effectiveQuality = item.qualityOverride ?? globalQuality;
      const { format_id, type } = qualityToFormatId(effectiveQuality);

      // Mark as queued
      setDownloadQueue(prev => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'queued' };
        return next;
      });

      try {
        const jobResp = await api.startDownload({
          url: item.video.url,
          format_id,
          download_type: type,
        });

        const jobId = jobResp.job_id;

        setDownloadQueue(prev => {
          const next = [...prev];
          next[index] = { ...next[index], jobId, status: 'downloading' };
          return next;
        });

        // Poll this job
        return new Promise<void>((resolve) => {
          const pollId = window.setInterval(async () => {
            try {
              const progress = await api.getDownloadProgress(jobId);

              setDownloadQueue(prev => {
                const next = [...prev];
                next[index] = {
                  ...next[index],
                  status: progress.status,
                  progress: progress.progress,
                  fileUrl: progress.status === 'completed' ? api.getDownloadFileUrl(jobId) : next[index].fileUrl,
                  error: progress.error ?? null,
                };
                return next;
              });

              if (progress.status === 'completed' || progress.status === 'failed') {
                clearInterval(pollId);
                delete channelPollsRef.current[jobId];
                resolve();
              }
            } catch (err) {
              console.error('Channel poll error:', err);
            }
          }, 800);

          channelPollsRef.current[jobId] = pollId;
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to start job';
        setDownloadQueue(prev => {
          const next = [...prev];
          next[index] = { ...next[index], status: 'failed', error: msg };
          return next;
        });
      }
    };

    if (mode === 'sequential') {
      // One at a time — await each before starting the next
      for (let i = 0; i < initialQueue.length; i++) {
        await downloadOne(initialQueue[i], i);
      }
    } else {
      // Parallel — fire all at once
      await Promise.all(initialQueue.map((item, i) => downloadOne(item, i)));
    }
  }, [channelInfo]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    stopPolling();
    stopAllChannelPolls();
    setAppState('idle');
    setViewMode('video');
    setCurrentUrl('');
    setVideoInfo(null);
    setChannelInfo(null);
    setDownloadProgress(null);
    setDownloadFileUrl(null);
    setDownloadQueue([]);
    setErrorMessage(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-start px-4 py-12 md:py-16">
      <div className="w-full max-w-4xl space-y-8">

        {/* Header */}
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold tracking-wide uppercase shadow-sm">
            <Youtube className="w-4 h-4 text-red-500" />
            <span>YouTube Downloader POC</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Download Videos for Offline Use
          </h1>

          <p className="text-slate-400 text-sm md:text-base max-w-lg mx-auto">
            Paste a <strong className="text-slate-300">video URL</strong> or a <strong className="text-slate-300">channel URL</strong> — we'll auto-detect and give you the right tools.
          </p>
        </header>

        {/* Main Card */}
        <main className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">

          {/* Error Banner */}
          {errorMessage && (
            <ErrorMessage
              message={errorMessage}
              onRetry={currentUrl ? () => handleAnalyze(currentUrl) : undefined}
              onDismiss={() => setErrorMessage(null)}
            />
          )}

          {/* ── URL Input ────────────────────────────────────────────── */}
          {(appState === 'idle' || appState === 'analyzing' || appState === 'error') && (
            <div className="space-y-4">
              <UrlInput
                onAnalyze={handleAnalyze}
                isLoading={appState === 'analyzing'}
                initialUrl={currentUrl}
              />
              <div className="pt-2 text-center text-xs text-slate-500 flex items-center justify-center gap-3">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  Single videos, Shorts, and Music URLs
                </span>
                <span className="text-slate-700">·</span>
                <span className="flex items-center gap-1.5">
                  <Tv2 className="w-4 h-4 text-slate-400" />
                  Channel URLs (youtube.com/@handle)
                </span>
              </div>
            </div>
          )}

          {/* ── Single Video: metadata + format selector ─────────────── */}
          {videoInfo && appState === 'ready' && viewMode === 'video' && (
            <div className="space-y-6 animate-fadeIn">
              <VideoInfo video={videoInfo} />
              <FormatSelector
                formats={videoInfo.formats}
                onDownload={handleVideoDownload}
                disabled={appState !== 'ready'}
              />
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors underline underline-offset-4"
                >
                  Analyze another URL
                </button>
              </div>
            </div>
          )}

          {/* ── Single Video: Download Progress ──────────────────────── */}
          {(appState === 'downloading' || appState === 'completed') && downloadProgress && viewMode === 'video' && (
            <div className="animate-fadeIn">
              <DownloadProgress
                progress={downloadProgress}
                fileUrl={downloadFileUrl || undefined}
                onReset={handleReset}
              />
            </div>
          )}

          {/* ── Channel: Video Browser ───────────────────────────────── */}
          {channelInfo && appState === 'ready' && viewMode === 'channel' && (
            <div>
              <ChannelBrowser
                channel={channelInfo}
                maxVideos={channelMaxVideos}
                onRefetch={handleChannelRefetch}
                isRefetching={isRefetchingChannel}
                onStartDownload={handleChannelDownload}
              />
              <div className="flex justify-center pt-6">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors underline underline-offset-4"
                >
                  Analyze another URL
                </button>
              </div>
            </div>
          )}

          {/* ── Channel: Download Queue ──────────────────────────────── */}
          {viewMode === 'channel-queue' && downloadQueue.length > 0 && (
            <DownloadQueue
              items={downloadQueue}
              onReset={handleReset}
            />
          )}

        </main>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-500 space-y-1">
          <p className="flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Local Proof of Concept demonstration &bull; Fast streaming with FFmpeg</span>
          </p>
          <p>Download only content for which you own the rights or have explicit authorization.</p>
        </footer>

      </div>
    </div>
  );
};
