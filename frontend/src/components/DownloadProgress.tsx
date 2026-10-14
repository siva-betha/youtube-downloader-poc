import React from 'react';
import { Download, Loader2, CheckCircle, AlertCircle, RefreshCw, HardDrive } from 'lucide-react';
import { DownloadProgress as DownloadProgressType } from '../types';

interface DownloadProgressProps {
  progress: DownloadProgressType;
  fileUrl?: string;
  onReset: () => void;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export const DownloadProgress: React.FC<DownloadProgressProps> = ({
  progress,
  fileUrl,
  onReset,
}) => {
  const isCompleted = progress.status === 'completed';
  const isFailed    = progress.status === 'failed';
  const isProcessing = progress.status === 'processing';
  const isDownloading = progress.status === 'downloading';

  // Phase label comes through the `eta` field from the backend
  const phaseLabels = ['Downloading video\u2026', 'Downloading audio\u2026', 'Merging streams\u2026'];
  const isPhaseLabel = progress.eta ? phaseLabels.some(l => progress.eta?.startsWith(l.slice(0, 12))) : false;

  const titleText = isCompleted
    ? 'Download Ready'
    : isFailed
    ? 'Download Failed'
    : isProcessing
    ? 'Merging Streams\u2026'
    : progress.eta === 'Downloading audio\u2026'
    ? 'Downloading Audio Stream (2/2)'
    : progress.progress > 0
    ? 'Downloading Video Stream (1/2)'
    : 'Starting Download\u2026';

  // Progress bar colour: red (video) → blue (audio) → amber (merge) → green (done)
  const barColour = isCompleted
    ? 'bg-emerald-500'
    : isFailed
    ? 'bg-red-500'
    : isProcessing
    ? 'bg-amber-500'
    : progress.eta === 'Downloading audio\u2026'
    ? 'bg-gradient-to-r from-blue-600 to-cyan-500'
    : 'bg-gradient-to-r from-red-600 to-rose-500';

  return (
    <div className="space-y-6 p-6 bg-slate-800/60 rounded-2xl border border-slate-700/80 shadow-xl">
      <div className="flex items-center justify-between">
        {/* Title */}
        <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          {isCompleted  && <CheckCircle className="w-5 h-5 text-emerald-400" />}
          {isProcessing && <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />}
          {isDownloading && <Download className="w-5 h-5 text-red-400 animate-bounce" />}
          {isFailed     && <AlertCircle className="w-5 h-5 text-red-400" />}
          <span>{titleText}</span>
        </h3>

        <span
          className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${
            isCompleted
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : isProcessing
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : isFailed
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
          }`}
        >
          {progress.status}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-400 font-medium">
          <span>Progress</span>
          <span className="text-slate-200 font-semibold">{Math.round(progress.progress)}%</span>
        </div>
        <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColour}`}
            style={{ width: `${Math.max(progress.progress, 4)}%` }}
          />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-300 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div>
          <span className="text-slate-400 block text-[11px]">Transferred</span>
          <span className="font-semibold text-slate-100">
            {formatBytes(progress.downloaded_bytes)}
            {progress.total_bytes ? ` / ${formatBytes(progress.total_bytes)}` : ''}
          </span>
        </div>

        {progress.speed && (
          <div>
            <span className="text-slate-400 block text-[11px]">Speed</span>
            <span className="font-semibold text-slate-100">{progress.speed}</span>
          </div>
        )}

        {/* Phase / ETA */}
        {!isCompleted && !isFailed && (
          <div>
            <span className="text-slate-400 block text-[11px]">
              {isProcessing ? 'Status' : isPhaseLabel ? 'Phase' : 'ETA'}
            </span>
            <span className={`font-semibold ${isProcessing ? 'text-amber-200' : 'text-slate-100'}`}>
              {isProcessing ? 'Merging streams\u2026' : progress.eta || '\u2014'}
            </span>
          </div>
        )}
      </div>

      {/* Error detail if any */}
      {isFailed && progress.error && (
        <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-xs text-red-300">
          {progress.error}
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 flex flex-col sm:flex-row gap-3">
        {isCompleted && fileUrl && (
          <a
            href={fileUrl}
            download
            className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition-all text-sm md:text-base text-center"
          >
            <HardDrive className="w-5 h-5" />
            <span>Download File to Computer</span>
          </a>
        )}

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-2 py-3 px-5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-slate-300 hover:text-white rounded-xl font-medium transition-all text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{isCompleted ? 'Convert Another Video' : 'Cancel & Reset'}</span>
        </button>
      </div>
    </div>
  );
};
