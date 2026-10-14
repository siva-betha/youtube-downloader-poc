import logging
from fastapi import APIRouter, HTTPException, status

from app.models import ChannelInfoRequest, ChannelInfoResponse, detect_url_type
from app.services.youtube_service import YouTubeService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Channel"])


@router.post(
    "/api/channel/info",
    response_model=ChannelInfoResponse,
    summary="Retrieve YouTube channel metadata and video list",
    responses={
        400: {"description": "Invalid channel URL or parameters"},
        502: {"description": "Failed to extract channel metadata from YouTube"},
    },
)
async def get_channel_info(payload: ChannelInfoRequest) -> ChannelInfoResponse:
    """Fetch a YouTube channel's metadata and a flat list of its videos."""
    logger.info(
        "Received channel info request for: %s (max_videos=%s)",
        payload.url,
        payload.max_videos,
    )
    try:
        info = YouTubeService.extract_channel_info(payload.url, payload.max_videos)
        return info
    except ValueError as ve:
        logger.warning("Validation error extracting channel info: %s", ve)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        ) from ve
    except Exception as e:
        logger.error("Failed to extract channel info: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to retrieve channel information. Please verify the URL and try again.",
        ) from e


@router.post(
    "/api/url/detect",
    summary="Detect whether a URL points to a video or a channel",
    responses={
        200: {"description": "Returns url_type: 'video' | 'channel' | 'unknown'"},
    },
)
async def detect_url(payload: dict) -> dict:
    """Quickly identify the type of a YouTube URL without fetching metadata."""
    url = (payload.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="URL is required")
    url_type = detect_url_type(url)
    return {"url": url, "url_type": url_type}
