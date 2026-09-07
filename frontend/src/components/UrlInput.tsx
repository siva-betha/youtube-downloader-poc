import React, { useState } from 'react';
import { Search, Loader2, Link2, X } from 'lucide-react';

interface UrlInputProps {
  onAnalyze: (url: string) => void;
  isLoading: boolean;
  initialUrl?: string;
}

export const UrlInput: React.FC<UrlInputProps> = ({ onAnalyze, isLoading, initialUrl = '' }) => {
  const [url, setUrl] = useState(initialUrl);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setValidationError('Please enter a YouTube video URL.');
      return;
    }

    const youtubeRegex = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})([?&].*)?$/;
    if (!youtubeRegex.test(trimmed)) {
      setValidationError('Please enter a valid YouTube URL (e.g. youtube.com/watch?v=... or youtu.be/...)');
      return;
    }

    setValidationError(null);
    onAnalyze(trimmed);
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative flex items-center">
          <div className="absolute left-4 pointer-events-none text-slate-400">
            <Link2 className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (validationError) setValidationError(null);
            }}
            disabled={isLoading}
            placeholder="Paste YouTube video or shorts URL here..."
            className="w-full pl-12 pr-12 py-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all shadow-inner text-sm md:text-base disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {url && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setUrl('');
                setValidationError(null);
              }}
              className="absolute right-4 text-slate-400 hover:text-slate-200 transition-colors"
              title="Clear input"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {validationError && (
          <p className="text-xs text-red-400 font-medium pl-1">{validationError}</p>
        )}

        <div className="flex justify-center pt-2">
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-medium rounded-xl shadow-lg shadow-red-600/25 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing Video...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Analyze</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
