import re
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


YOUTUBE_URL_REGEX = re.compile(
    r"^(https?://)?(www\.|m\.|music\.)?(youtube\.com/(watch\?v=|shorts/|embed/)|youtu\.be/)([a-zA-Z0-9_-]{11})([?&].*)?$"
)

YOUTUBE_CHANNEL_URL_REGEX = re.compile(
    r"^(https?://)?(www\.)?youtube\.com/(@[a-zA-Z0-9_.-]+|channel/[a-zA-Z0-9_-]+|c/[a-zA-Z0-9_.-]+|user/[a-zA-Z0-9_.-]+)(/.*)?$"
)


def detect_url_type(url: str) -> str:
    """Return 'video', 'channel', or 'unknown' for the given URL."""
    clean = url.strip()
    if YOUTUBE_URL_REGEX.match(clean):
        return "video"
    if YOUTUBE_CHANNEL_URL_REGEX.match(clean):
        return "channel"
    return "unknown"


class VideoInfoRequest(BaseModel):
    url: str = Field(..., description="YouTube video URL to analyze")

    @field_validator("url")
    @classmethod
    def validate_youtube_url(cls, v: str) -> str:
        clean_url = v.strip()
        if not clean_url:
            raise ValueError("URL cannot be empty")
        if not YOUTUBE_URL_REGEX.match(clean_url):
            raise ValueError("Invalid YouTube URL. Supported formats: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...")
        return clean_url


class ChannelInfoRequest(BaseModel):
    url: str = Field(..., description="YouTube channel URL")
    max_videos: Optional[int] = Field(default=20, ge=1, le=500, description="Max videos to fetch (1-500). None = all.")

    @field_validator("url")
    @classmethod
    def validate_channel_url(cls, v: str) -> str:
        clean_url = v.strip()
        if not clean_url:
            raise ValueError("URL cannot be empty")
        if not YOUTUBE_CHANNEL_URL_REGEX.match(clean_url):
            raise ValueError(
                "Invalid YouTube channel URL. Supported formats: youtube.com/@handle, "
                "youtube.com/channel/UC..., youtube.com/c/name"
            )
        return clean_url


class ChannelVideoItem(BaseModel):
    id: str
    title: str
    url: str
    thumbnail: Optional[str] = None
    duration: Optional[int] = None
    duration_formatted: Optional[str] = None
    view_count: Optional[int] = None
    upload_date: Optional[str] = None  # YYYYMMDD string from yt-dlp


class ChannelInfoResponse(BaseModel):
    channel_id: str
    channel_name: str
    channel_url: str
    thumbnail: Optional[str] = None
    video_count: int
    videos: List[ChannelVideoItem]


class FormatInfo(BaseModel):
    format_id: str
    extension: str
    resolution: Optional[str] = None
    fps: Optional[int] = None
    filesize: Optional[int] = None
    type: str  # "video" or "audio"


class VideoInfoResponse(BaseModel):
    id: str
    title: str
    channel: str
    duration: Optional[int] = None
    duration_formatted: Optional[str] = None
    thumbnail: Optional[str] = None
    formats: List[FormatInfo] = []


class DownloadRequest(BaseModel):
    url: str
    format_id: str
    download_type: str = Field(default="video", pattern="^(video|audio)$")
    quality: Optional[str] = None

    @field_validator("url")
    @classmethod
    def validate_youtube_url(cls, v: str) -> str:
        clean_url = v.strip()
        if not clean_url:
            raise ValueError("URL cannot be empty")
        if not YOUTUBE_URL_REGEX.match(clean_url):
            raise ValueError("Invalid YouTube URL")
        return clean_url


class JobStatus(str, Enum):
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class DownloadJobResponse(BaseModel):
    job_id: str


class DownloadProgressResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: float = 0.0
    downloaded_bytes: Optional[int] = None
    total_bytes: Optional[int] = None
    speed: Optional[str] = None
    eta: Optional[str] = None
    filename: Optional[str] = None
    download_url: Optional[str] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str = "ok"
