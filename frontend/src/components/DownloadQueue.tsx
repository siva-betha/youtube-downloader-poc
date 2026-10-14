import React from 'react';
import {
  CheckCircle2, XCircle, Clock, Download, Loader2, RefreshCw
} from 'lucide-react';
import { ChannelDownloadItem } from '../types';
import { api } from '../services/api';

interface DownloadQueueProps {
  items: ChannelDownloadItem[];
  onReset: () => void;
}

function StatusIcon({ status }: { status: ChannelDownloadItem['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
    case 'downloading':
    case 'processing':
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />;
    case 'queued':
      return <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />;
    default:
      return <Clock className="w-4 h-4 text-slate-600 flex-shrink-0" />;
  }
}

function StatusBadge({ status }: { status: ChannelDownloadItem['status'] }) {
  const cfg: Record<string, string> = {
    pending:     'bg-slate-700/60 text-slate-400',
    queued:      'bg-slate-700/60 text-slate-400',
    downloading: 'bg-blue-500/15 text-blue-400',
    processing:  'bg-amber-500/15 text-amber-400',
    completed:   'bg-emerald-500/15 text-emerald-400',
    failed:      'bg-red-500/15 text-red-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg[status] || cfg.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export const DownloadQueue: React.FC<DownloadQueueProps> = ({ items, onReset }) => {
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;
  const activeCount = items.filter(i => i.status === 'downloading' || i.status === 'processing').length;
  const allDone = items.every(i => i.status === 'completed' || i.status === 'failed');

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">Download Queue</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {completedCount} done · {failedCount} failed · {activeCount} active · {items.length - completedCount - failedCount - activeCount} pending
          </p>
        </div>
        {allDone && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 text-xs text-slate-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Start Over
          </button>
        )}
      </div>

      {/* Overall progress bar */}
      <div className="space-y-1">
        <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / items.length) * 100}%` }}
          />
        </div>
        <p className="text-right text-xs text-slate-500">{completedCount} / {items.length}</p>
      </div>

      {/* Per-video rows */}
      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
        {items.map((item) => {
          const thumbUrl = item.video.thumbnail
            || `https://img.youtube.com/vi/${item.video.id}/mqdefault.jpg`;

          return (
            <div
              key={item.video.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors
                ${item.status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/5' :
                  item.status === 'failed' ? 'border-red-500/20 bg-red-500/5' :
                  item.status === 'downloading' || item.status === 'processing' ? 'border-blue-500/20 bg-blue-500/5' :
                  'border-slate-700/40 bg-slate-800/30'}`}
            >
              {/* Thumbnail */}
              <img
                src={thumbUrl}
                alt={item.video.title}
                className="w-14 h-10 object-cover rounded-lg flex-shrink-0 bg-slate-800"
                loading="lazy"
                onError={e => { e.currentTarget.src = `https://img.youtube.com/vi/${item.video.id}/mqdefault.jpg`; }}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate font-medium">{item.video.title}</p>

                {/* Progress bar (for active downloads) */}
                {(item.status === 'downloading' || item.status === 'processing') && (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">{item.progress.toFixed(0)}%</p>
                  </div>
                )}

                {/* Error */}
                {item.status === 'failed' && item.error && (
                  <p className="text-xs text-red-400 mt-0.5 truncate">{item.error}</p>
                )}
              </div>

              {/* Status + download button */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusBadge status={item.status} />
                <StatusIcon status={item.status} />
                {item.status === 'completed' && item.jobId && (
                  <a
                    href={api.getDownloadFileUrl(item.jobId)}
                    download
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Save
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
