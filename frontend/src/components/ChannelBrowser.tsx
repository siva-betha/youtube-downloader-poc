import React, { useState, useCallback } from 'react';
import {
  Users, RefreshCw, CheckSquare, Square, Play, Download,
  ListVideo, Zap, Clock, Eye, ChevronDown, X
} from 'lucide-react';
import { ChannelInfo, ChannelVideoItem, DownloadMode, QualityPreset } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUALITY_OPTIONS: { label: string; value: QualityPreset }[] = [
  { label: 'Best Quality', value: 'best' },
  { label: '1080p', value: '1080p' },
  { label: '720p', value: '720p' },
  { label: '480p', value: '480p' },
  { label: '360p', value: '360p' },
  { label: 'Audio Only', value: 'audio' },
];

const MAX_VIDEO_OPTIONS = [
  { label: 'Last 10', value: 10 },
  { label: 'Last 20', value: 20 },
  { label: 'Last 50', value: 50 },
  { label: 'Last 100', value: 100 },
  { label: 'All Videos', value: null },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatViews(count: number | null | undefined): string {
  if (!count) return '—';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
  return `${count} views`;
}

function formatUploadDate(raw: string | null | undefined): string {
  if (!raw || raw.length < 8) return '';
  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);
  return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface VideoCardProps {
  video: ChannelVideoItem;
  selected: boolean;
  qualityOverride: QualityPreset | null;
  onToggle: (id: string) => void;
  onQualityChange: (id: string, q: QualityPreset | null) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, selected, qualityOverride, onToggle, onQualityChange }) => {
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const thumbUrl = video.thumbnail
    ? video.thumbnail
    : `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`;

  return (
    <div
      className={`relative group rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden
        ${selected
          ? 'border-red-500/70 bg-red-500/10 shadow-lg shadow-red-500/10'
          : 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
        }`}
      onClick={() => onToggle(video.id)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-slate-900 overflow-hidden">
        <img
          src={thumbUrl}
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.src.includes('mqdefault')) {
              img.src = `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`;
            }
          }}
        />
        {/* Duration badge */}
        {video.duration_formatted && (
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
            {video.duration_formatted}
          </span>
        )}
        {/* Play overlay */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200
          ${selected ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
        </div>
        {/* Selection overlay */}
        {selected && (
          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
              <CheckSquare className="w-5 h-5 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <p className="text-sm font-medium text-slate-100 line-clamp-2 leading-snug">
          {video.title}
        </p>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {video.view_count != null && (
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {formatViews(video.view_count)}
            </span>
          )}
          {video.upload_date && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatUploadDate(video.upload_date)}
            </span>
          )}
        </div>

        {/* Per-video quality override — only visible when selected */}
        {selected && (
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowQualityMenu(!showQualityMenu)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-700/60 border border-slate-600/50 text-xs text-slate-300 hover:border-red-500/50 transition-colors"
            >
              <span>{qualityOverride ? QUALITY_OPTIONS.find(q => q.value === qualityOverride)?.label : 'Use global quality'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showQualityMenu ? 'rotate-180' : ''}`} />
            </button>
            {showQualityMenu && (
              <div className="absolute z-20 bottom-full mb-1 left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => { onQualityChange(video.id, null); setShowQualityMenu(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-700 transition-colors"
                >
                  Use global quality
                </button>
                {QUALITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onQualityChange(video.id, opt.value); setShowQualityMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-slate-700
                      ${qualityOverride === opt.value ? 'text-red-400 font-semibold' : 'text-slate-300'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Channel Header ───────────────────────────────────────────────────────────

interface ChannelHeaderProps {
  channel: ChannelInfo;
  maxVideos: number | null;
  onRefetch: (max: number | null) => void;
  isRefetching: boolean;
}

const ChannelHeader: React.FC<ChannelHeaderProps> = ({ channel, maxVideos, onRefetch, isRefetching }) => {
  const [selectedMax, setSelectedMax] = useState<number | null>(maxVideos);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-800/60 rounded-2xl border border-slate-700/50">
      {/* Avatar placeholder */}
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg">
        <Users className="w-7 h-7 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-base font-bold text-white truncate">{channel.channel_name}</h2>
        <p className="text-xs text-slate-400">{channel.video_count} videos loaded</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Max videos picker */}
        <div className="relative">
          <select
            value={selectedMax === null ? 'all' : String(selectedMax)}
            onChange={e => setSelectedMax(e.target.value === 'all' ? null : Number(e.target.value))}
            className="appearance-none bg-slate-700/60 border border-slate-600/50 text-slate-300 text-xs rounded-xl px-3 py-2 pr-7 focus:outline-none focus:border-red-500/50 cursor-pointer"
          >
            {MAX_VIDEO_OPTIONS.map(opt => (
              <option key={String(opt.value)} value={opt.value === null ? 'all' : String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <button
          type="button"
          onClick={() => onRefetch(selectedMax)}
          disabled={isRefetching}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 rounded-xl text-xs text-slate-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          Refetch
        </button>
      </div>
    </div>
  );
};

// ─── Main Channel Browser ─────────────────────────────────────────────────────

interface ChannelBrowserProps {
  channel: ChannelInfo;
  maxVideos: number | null;
  onRefetch: (max: number | null) => void;
  isRefetching: boolean;
  onStartDownload: (
    selectedIds: string[],
    qualityOverrides: Record<string, QualityPreset | null>,
    globalQuality: QualityPreset,
    mode: DownloadMode
  ) => void;
}

export const ChannelBrowser: React.FC<ChannelBrowserProps> = ({
  channel,
  maxVideos,
  onRefetch,
  isRefetching,
  onStartDownload,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [qualityOverrides, setQualityOverrides] = useState<Record<string, QualityPreset | null>>({});
  const [globalQuality, setGlobalQuality] = useState<QualityPreset>('best');
  const [downloadMode, setDownloadMode] = useState<DownloadMode>('sequential');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVideos = searchQuery.trim()
    ? channel.videos.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : channel.videos;

  const toggleVideo = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = () => {
    if (selectedIds.size === filteredVideos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVideos.map(v => v.id)));
    }
  };

  const setQualityOverride = useCallback((id: string, q: QualityPreset | null) => {
    setQualityOverrides(prev => ({ ...prev, [id]: q }));
  }, []);

  const handleStartDownload = () => {
    if (selectedIds.size === 0) return;
    onStartDownload([...selectedIds], qualityOverrides, globalQuality, downloadMode);
  };

  const allSelected = filteredVideos.length > 0 && selectedIds.size === filteredVideos.length;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Channel Header */}
      <ChannelHeader
        channel={channel}
        maxVideos={maxVideos}
        onRefetch={onRefetch}
        isRefetching={isRefetching}
      />

      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Filter videos…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500/50 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Select All */}
        <button
          type="button"
          onClick={toggleAll}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/60 border border-slate-700/50 hover:border-slate-600 rounded-xl text-sm text-slate-300 transition-colors"
        >
          {allSelected ? <CheckSquare className="w-4 h-4 text-red-400" /> : <Square className="w-4 h-4" />}
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Result count */}
      <p className="text-xs text-slate-500 px-1">
        {searchQuery
          ? `${filteredVideos.length} of ${channel.videos.length} videos match`
          : `${channel.videos.length} videos · ${selectedIds.size} selected`}
      </p>

      {/* Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {filteredVideos.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-500 text-sm">
            No videos match your filter.
          </div>
        ) : (
          filteredVideos.map(video => (
            <VideoCard
              key={video.id}
              video={video}
              selected={selectedIds.has(video.id)}
              qualityOverride={qualityOverrides[video.id] ?? null}
              onToggle={toggleVideo}
              onQualityChange={setQualityOverride}
            />
          ))
        )}
      </div>

      {/* Download Controls — sticky at bottom when videos are selected */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-0 pt-4 bg-gradient-to-t from-slate-900 via-slate-900/95 to-transparent">
          <div className="bg-slate-800/90 backdrop-blur border border-slate-700/60 rounded-2xl p-4 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Global quality */}
              <div className="flex-1">
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Global Quality</label>
                <div className="relative">
                  <select
                    value={globalQuality}
                    onChange={e => setGlobalQuality(e.target.value as QualityPreset)}
                    className="w-full appearance-none bg-slate-700/60 border border-slate-600/50 text-slate-200 text-sm rounded-xl px-3 py-2.5 pr-8 focus:outline-none focus:border-red-500/50 cursor-pointer"
                  >
                    {QUALITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Download mode */}
              <div className="flex-1">
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Download Mode</label>
                <div className="flex rounded-xl overflow-hidden border border-slate-600/50">
                  <button
                    type="button"
                    onClick={() => setDownloadMode('sequential')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors
                      ${downloadMode === 'sequential'
                        ? 'bg-red-500/20 text-red-400 border-r border-red-500/30'
                        : 'bg-slate-700/40 text-slate-400 hover:text-slate-300 border-r border-slate-600/50'}`}
                  >
                    <ListVideo className="w-3.5 h-3.5" />
                    Sequential
                  </button>
                  <button
                    type="button"
                    onClick={() => setDownloadMode('parallel')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors
                      ${downloadMode === 'parallel'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-slate-700/40 text-slate-400 hover:text-slate-300'}`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Parallel
                  </button>
                </div>
              </div>
            </div>

            {/* Download button */}
            <button
              type="button"
              onClick={handleStartDownload}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-red-500/20 hover:shadow-red-500/30 active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              Download {selectedIds.size} Video{selectedIds.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
