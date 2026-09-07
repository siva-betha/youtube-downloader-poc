import logging
from typing import Any, Dict, List, Optional
import yt_dlp

from app.models import FormatInfo, VideoInfoResponse

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
        for f in formats:
            # Check if format has video stream
            vcodec = f.get("vcodec", "none")
            height = f.get("height")
            ext = f.get("ext", "mp4")

            if vcodec and vcodec != "none" and height and isinstance(height, int) and height >= 144:
                res_label = f"{height}p"
                format_id = str(f.get("format_id", ""))
                filesize = f.get("filesize") or f.get("filesize_approx")
                fps = f.get("fps")

                # Prefer mp4 container or higher filesize / better format
                current_candidate = FormatInfo(
                    format_id=format_id,
                    extension="mp4",
                    resolution=res_label,
                    fps=int(fps) if fps else None,
                    filesize=int(filesize) if filesize else None,
                    type="video",
                )

                if res_label not in video_by_resolution:
                    video_by_resolution[res_label] = current_candidate
                else:
                    # Update if current is mp4 and existing is not, or higher filesize
                    existing = video_by_resolution[res_label]
                    if ext == "mp4" and (filesize or 0) >= (existing.filesize or 0):
                        video_by_resolution[res_label] = current_candidate

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
        best_audio_id = "bestaudio"
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
