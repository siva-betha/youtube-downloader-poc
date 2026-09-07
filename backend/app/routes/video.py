import logging
from fastapi import APIRouter, HTTPException, status

from app.models import VideoInfoRequest, VideoInfoResponse
from app.services.youtube_service import YouTubeService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/video", tags=["Video"])


@router.post(
    "/info",
    response_model=VideoInfoResponse,
    summary="Retrieve YouTube video metadata and available formats",
    responses={
        400: {"description": "Invalid video URL or parameters"},
        502: {"description": "Failed to extract metadata from YouTube"},
    },
)
async def get_video_info(payload: VideoInfoRequest) -> VideoInfoResponse:
    """Analyze a YouTube URL and return video information and available formats."""
    logger.info("Received video info request for: %s", payload.url)
    try:
        info = YouTubeService.extract_video_info(payload.url)
        return info
    except ValueError as ve:
        logger.warning("Validation error extracting info: %s", ve)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        ) from ve
    except Exception as e:
        logger.error("Failed to extract info: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to retrieve video information. Please verify the URL and try again.",
        ) from e
