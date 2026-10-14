import logging
from typing import Any, Dict, List, Optional
import yt_dlp

from app.models import ChannelInfoResponse, ChannelVideoItem, FormatInfo, VideoInfoResponse

logger = logging.getLogger(__name__)


def format_duration(seconds: Optional[int]) -> Optional[str]:
    """Convert duration in seconds to MM:SS or HH:MM:SS string."""
    if seconds is None or seconds < 0:
        return None
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


class YouTubeService:
    """Service to interact with YouTube via yt-dlp."""

    @staticmethod
    def extract_video_info(url: str) -> VideoInfoResponse:
        """Extract metadata and available formats for a given YouTube URL."""
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "extract_flat": False,
            "socket_timeout": 15,
        }

        try:
            logger.info("Extracting video metadata for URL: %s", url)
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_dict = ydl.extract_info(url, download=False)
        except Exception as e:
            logger.error("Failed to extract video info for %s: %s", url, str(e))
            raise RuntimeError(f"Unable to retrieve video information: {str(e)}") from e

        if not info_dict:
            raise RuntimeError("Unable to retrieve video information: empty metadata returned")

        video_id = str(info_dict.get("id") or "")
        title = str(info_dict.get("title") or "Unknown Title")
        channel = str(info_dict.get("uploader") or info_dict.get("channel") or "Unknown Channel")
        duration = info_dict.get("duration")
        duration_formatted = format_duration(duration) if duration else None
        thumbnail = info_dict.get("thumbnail")

        raw_formats = info_dict.get("formats", [])
        parsed_formats = YouTubeService._parse_formats(raw_formats)

        return VideoInfoResponse(
            id=video_id,
            title=title,
            channel=channel,
            duration=duration,
            duration_formatted=duration_formatted,
            thumbnail=thumbnail,
            formats=parsed_formats,
        )

    @staticmethod
    def _parse_formats(formats: List[Dict[str, Any]]) -> List[FormatInfo]:
        """Filter and deduplicate useful video resolutions and audio formats."""
        result: List[FormatInfo] = []
        video_by_resolution: Dict[str, FormatInfo] = {}

        # Scan for best video formats per resolution
        # Track (FormatInfo, is_mp4) to prioritize MP4 container for instant, zero-transcode merging
        video_candidates: Dict[str, tuple[FormatInfo, bool]] = {}

        for f in formats:
            # Check if format has video stream
            vcodec = f.get("vcodec", "none")
            height = f.get("height")
            ext = f.get("ext", "")
            is_mp4 = (ext == "mp4")

            if vcodec and vcodec != "none" and height and isinstance(height, int) and height >= 144:
                res_label = f"{height}p"
                format_id = str(f.get("format_id", ""))
                filesize = f.get("filesize") or f.get("filesize_approx") or 0
                fps = f.get("fps")

                candidate = FormatInfo(
                    format_id=format_id,
                    extension="mp4",
                    resolution=res_label,
                    fps=int(fps) if fps else None,
                    filesize=int(filesize) if filesize else None,
                    type="video",
                )

                if res_label not in video_candidates:
                    video_candidates[res_label] = (candidate, is_mp4)
                else:
                    existing_cand, existing_is_mp4 = video_candidates[res_label]
                    existing_size = existing_cand.filesize or 0

                    # Prefer native MP4 streams over WebM for instant stream-copy merging
                    if is_mp4 and not existing_is_mp4:
                        video_candidates[res_label] = (candidate, is_mp4)
                    elif (is_mp4 == existing_is_mp4) and (filesize > existing_size):
                        video_candidates[res_label] = (candidate, is_mp4)

        video_by_resolution = {res: cand for res, (cand, _) in video_candidates.items()}

        # Sort video resolutions from highest to lowest
        sorted_resolutions = sorted(
            video_by_resolution.keys(),
            key=lambda r: int(r.replace("p", "")) if r.replace("p", "").isdigit() else 0,
            reverse=True,
        )
        for res in sorted_resolutions:
            result.append(video_by_resolution[res])

        # Find best audio format
        best_audio_filesize = None
        best_audio_id = "bestaudio[ext=m4a]/bestaudio"
        for f in formats:
            acodec = f.get("acodec", "none")
            vcodec = f.get("vcodec", "none")
            if (vcodec == "none" or not vcodec) and acodec and acodec != "none":
                f_size = f.get("filesize") or f.get("filesize_approx")
                if f_size and (best_audio_filesize is None or f_size > best_audio_filesize):
                    best_audio_filesize = int(f_size)
                    best_audio_id = str(f.get("format_id", "bestaudio"))

        result.append(
            FormatInfo(
                format_id=best_audio_id,
                extension="mp3",
                resolution="Audio Only",
                fps=None,
                filesize=best_audio_filesize,
                type="audio",
            )
        )

        return result

    @staticmethod
    def extract_channel_info(url: str, max_videos: Optional[int] = 20) -> ChannelInfoResponse:
        """Fetch channel metadata and a flat list of its videos using yt-dlp."""
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": True,       # Fast: list entries without downloading each page
            "skip_download": True,
            "socket_timeout": 30,
            "playlistend": max_videos,  # Limit entries fetched; None = all
        }

        try:
            logger.info("Extracting channel info for URL: %s (max_videos=%s)", url, max_videos)
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_dict = ydl.extract_info(url, download=False)
        except Exception as e:
            logger.error("Failed to extract channel info for %s: %s", url, str(e))
            raise RuntimeError(f"Unable to retrieve channel information: {str(e)}") from e

        if not info_dict:
            raise RuntimeError("Unable to retrieve channel information: empty metadata returned")

        channel_id = str(info_dict.get("channel_id") or info_dict.get("id") or "")
        channel_name = str(
            info_dict.get("channel")
            or info_dict.get("uploader")
            or info_dict.get("title")
            or "Unknown Channel"
        )
        channel_url = str(info_dict.get("channel_url") or info_dict.get("uploader_url") or url)
        channel_thumbnail = info_dict.get("thumbnail")

        raw_entries = info_dict.get("entries") or []

        videos: List[ChannelVideoItem] = []
        for entry in raw_entries:
            if not entry:
                continue
            vid_id = str(entry.get("id") or "")
            if not vid_id:
                continue

            vid_title = str(entry.get("title") or "Untitled")
            vid_url = entry.get("url") or entry.get("webpage_url") or f"https://www.youtube.com/watch?v={vid_id}"

            # Ensure it's an absolute URL
            if not vid_url.startswith("http"):
                vid_url = f"https://www.youtube.com/watch?v={vid_id}"

            duration = entry.get("duration")
            duration_fmt = format_duration(int(duration)) if duration else None
            thumbnail = entry.get("thumbnail") or entry.get("thumbnails")
            if isinstance(thumbnail, list) and thumbnail:
                # Pick last (usually highest-res)
                thumbnail = thumbnail[-1].get("url") if isinstance(thumbnail[-1], dict) else None

            videos.append(
                ChannelVideoItem(
                    id=vid_id,
                    title=vid_title,
                    url=vid_url,
                    thumbnail=thumbnail,
                    duration=int(duration) if duration else None,
                    duration_formatted=duration_fmt,
                    view_count=entry.get("view_count"),
                    upload_date=str(entry.get("upload_date") or ""),
                )
            )

        return ChannelInfoResponse(
            channel_id=channel_id,
            channel_name=channel_name,
            channel_url=channel_url,
            thumbnail=channel_thumbnail,
            video_count=len(videos),
            videos=videos,
        )
