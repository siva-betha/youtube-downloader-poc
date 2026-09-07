import React, { useState, useMemo } from 'react';
import { Video, Music, Download, CheckCircle2 } from 'lucide-react';
import { FormatInfo } from '../types';

interface FormatSelectorProps {
  formats: FormatInfo[];
  onDownload: (formatId: string, type: 'video' | 'audio', quality?: string) => void;
  disabled?: boolean;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return ` (~${val.toFixed(1)} ${units[i]})`;
}

export const FormatSelector: React.FC<FormatSelectorProps> = ({ formats, onDownload, disabled }) => {
  const [selectedType, setSelectedType] = useState<'video' | 'audio'>('video');

  const videoFormats = useMemo(() => {
    return formats.filter((f) => f.type === 'video');
  }, [formats]);

  const audioFormats = useMemo(() => {
    return formats.filter((f) => f.type === 'audio');
  }, [formats]);

  const [selectedFormatId, setSelectedFormatId] = useState<string>(() => {
    if (videoFormats.length > 0) return videoFormats[0].format_id;
    if (audioFormats.length > 0) return audioFormats[0].format_id;
    return '';
  });

  // Switch type and auto-select primary format for that type
  const handleTypeChange = (type: 'video' | 'audio') => {
    setSelectedType(type);
    if (type === 'video' && videoFormats.length > 0) {
      // Default to 720p if available, else first
      const p720 = videoFormats.find((f) => f.resolution === '720p');
      setSelectedFormatId(p720 ? p720.format_id : videoFormats[0].format_id);
    } else if (type === 'audio' && audioFormats.length > 0) {
      setSelectedFormatId(audioFormats[0].format_id);
    }
  };

  const handleStartDownload = () => {
    if (selectedType === 'video') {
      const activeFmt = videoFormats.find((f) => f.format_id === selectedFormatId) || videoFormats[0];
      if (activeFmt) {
        onDownload(activeFmt.format_id, 'video', activeFmt.resolution || undefined);
      }
    } else {
      const activeFmt = audioFormats.find((f) => f.format_id === selectedFormatId) || audioFormats[0];
      if (activeFmt) {
        onDownload(activeFmt.format_id, 'audio');
      }
    }
  };

  return (
    <div className="space-y-5 pt-2">
      {/* Type Toggle Tabs */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Download Type
        </label>
        <div className="grid grid-cols-2 gap-3 p-1 bg-slate-800/80 rounded-xl border border-slate-700/80">
          <button
            type="button"
            onClick={() => handleTypeChange('video')}
            disabled={disabled || videoFormats.length === 0}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
              selectedType === 'video'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Video className="w-4 h-4" />
            <span>MP4 Video</span>
          </button>

          <button
            type="button"
            onClick={() => handleTypeChange('audio')}
            disabled={disabled || audioFormats.length === 0}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
              selectedType === 'audio'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Music className="w-4 h-4" />
            <span>MP3 Audio</span>
          </button>
        </div>
      </div>

      {/* Quality / Stream Selection */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          {selectedType === 'video' ? 'Select Video Quality' : 'Audio Quality'}
        </label>

        {selectedType === 'video' ? (
          videoFormats.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {videoFormats.map((f) => {
                const isSelected = f.format_id === selectedFormatId;
                return (
                  <button
                    key={f.format_id}
                    type="button"
                    onClick={() => setSelectedFormatId(f.format_id)}
                    disabled={disabled}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-red-500 bg-red-500/10 text-white ring-1 ring-red-500'
                        : 'border-slate-700/80 bg-slate-800/40 text-slate-300 hover:border-slate-600 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold text-sm">{f.resolution || 'Standard'}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-red-500" />}
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1">
                      MP4 {formatBytes(f.filesize)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No compatible video streams detected.</p>
          )
        ) : (
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-100">Best Available Audio</div>
                <div className="text-xs text-slate-400">
                  Auto-converted to 192kbps MP3
                  {audioFormats[0] && formatBytes(audioFormats[0].filesize)}
                </div>
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-red-500" />
          </div>
        )}
      </div>

      {/* Download Action Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleStartDownload}
          disabled={disabled || !selectedFormatId}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold rounded-xl shadow-lg shadow-red-600/25 transition-all text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          <span>Start Download</span>
        </button>
      </div>
    </div>
  );
};
