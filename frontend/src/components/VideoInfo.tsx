import React from 'react';
import { Clock, User } from 'lucide-react';
import { VideoInfo as VideoInfoType } from '../types';

interface VideoInfoProps {
  video: VideoInfoType;
}

export const VideoInfo: React.FC<VideoInfoProps> = ({ video }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-5 items-start p-4 bg-slate-800/50 rounded-xl border border-slate-700/60">
      {/* Thumbnail */}
      <div className="relative w-full sm:w-48 aspect-video sm:h-28 rounded-lg overflow-hidden bg-slate-950 flex-shrink-0 shadow-md">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
            No preview
          </div>
        )}
        {video.duration_formatted && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/80 backdrop-blur-sm text-white text-[11px] font-semibold px-1.5 py-0.5 rounded tracking-wide">
            {video.duration_formatted}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 flex flex-col justify-center space-y-2">
        <h3 className="font-semibold text-slate-100 text-base md:text-lg leading-snug line-clamp-2" title={video.title}>
          {video.title}
        </h3>

        <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-slate-400">
          <div className="flex items-center gap-1.5">
            <User className="w-4 h-4 text-slate-500" />
            <span className="truncate max-w-[200px]" title={video.channel}>
              {video.channel}
            </span>
          </div>

          {video.duration_formatted && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>{video.duration_formatted}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
