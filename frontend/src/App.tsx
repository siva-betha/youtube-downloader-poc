import React, { useState, useEffect, useRef } from 'react';
import { Youtube, Sparkles, ShieldCheck } from 'lucide-react';
import { UrlInput } from './components/UrlInput';
import { VideoInfo } from './components/VideoInfo';
import { FormatSelector } from './components/FormatSelector';
import { DownloadProgress } from './components/DownloadProgress';
import { ErrorMessage } from './components/ErrorMessage';
import { api } from './services/api';
import { AppState, DownloadProgress as DownloadProgressType, VideoInfo as VideoInfoType } from './types';

export const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('idle');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [videoInfo, setVideoInfo] = useState<VideoInfoType | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressType | null>(null);
  const [downloadFileUrl, setDownloadFileUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollIntervalRef = useRef<number | null>(null);

  // Clear polling interval when unmounting or changing job
  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  // 1. Analyze video URL
  const handleAnalyze = async (url: string) => {
    setErrorMessage(null);
    setCurrentUrl(url);
    setAppState('analyzing');

    try {
      const data = await api.getVideoInfo(url);
      setVideoInfo(data);
      setAppState('ready');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to analyze video URL';
      setErrorMessage(msg);
      setAppState('error');
    }
  };

  // 2. Start download
  const handleDownload = async (formatId: string, type: 'video' | 'audio', quality?: string) => {
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

      // Initial progress state
      setDownloadProgress({
        job_id: jobId,
        status: 'queued',
        progress: 0,
      });

      // Start polling
      startPollingProgress(jobId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start download';
      setErrorMessage(msg);
      setAppState('error');
    }
  };

  // 3. Poll progress every 800ms
  const startPollingProgress = (jobId: string) => {
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
      } catch (err: unknown) {
        logger_error(err);
      }
    }, 800);
  };

  const logger_error = (err: unknown) => {
    console.error('Polling error:', err);
  };

  // 4. Reset entire form
  const handleReset = () => {
    stopPolling();
    setAppState('idle');
    setCurrentUrl('');
    setVideoInfo(null);
    setDownloadProgress(null);
    setDownloadFileUrl(null);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-start px-4 py-12 md:py-16">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold tracking-wide uppercase shadow-sm">
            <Youtube className="w-4 h-4 text-red-500" />
            <span>YouTube Downloader POC</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Download Videos for Offline Use
          </h1>

          <p className="text-slate-400 text-sm md:text-base max-w-md mx-auto">
            Inspect video formats, choose resolutions or MP3 audio, and convert content you are authorized to download.
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

          {/* Section 1: URL Input (Active in Idle / Error / Analyzing) */}
          {(appState === 'idle' || appState === 'analyzing' || appState === 'error') && (
            <div className="space-y-4">
              <UrlInput
                onAnalyze={handleAnalyze}
                isLoading={appState === 'analyzing'}
                initialUrl={currentUrl}
              />

              <div className="pt-2 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                <span>Supports regular videos, shorts, and music URLs</span>
              </div>
            </div>
          )}

          {/* Section 2: Video Metadata & Format Selection */}
          {videoInfo && appState === 'ready' && (
            <div className="space-y-6 animate-fadeIn">
              <VideoInfo video={videoInfo} />
              <FormatSelector
                formats={videoInfo.formats}
                onDownload={handleDownload}
                disabled={appState !== 'ready'}
              />

              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors underline underline-offset-4"
                >
                  Analyze another video
                </button>
              </div>
            </div>
          )}

          {/* Section 3: Download Progress & Completion */}
          {(appState === 'downloading' || appState === 'completed') && downloadProgress && (
            <div className="animate-fadeIn">
              <DownloadProgress
                progress={downloadProgress}
                fileUrl={downloadFileUrl || undefined}
                onReset={handleReset}
              />
            </div>
          )}
        </main>

        {/* Footer info */}
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
