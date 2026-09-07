import logging
import mimetypes
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.models import DownloadJobResponse, DownloadProgressResponse, DownloadRequest
from app.services.download_service import download_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/download", tags=["Download"])


@router.post(
    "",
    response_model=DownloadJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start a background media download",
    responses={
        400: {"description": "Invalid download request payload"},
    },
)
async def start_download(payload: DownloadRequest) -> DownloadJobResponse:
    """Queue a media download job for a YouTube video."""
    logger.info(
        "Received download request: url=%s, type=%s, format_id=%s, quality=%s",
        payload.url,
        payload.download_type,
        payload.format_id,
        payload.quality,
    )
    try:
        job_id = download_service.create_job(
            url=payload.url,
            format_id=payload.format_id,
            download_type=payload.download_type,
            quality=payload.quality,
        )
        return DownloadJobResponse(job_id=job_id)
    except Exception as e:
        logger.error("Failed to start download job: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate download job",
        ) from e


@router.get(
    "/{job_id}/progress",
    response_model=DownloadProgressResponse,
    summary="Track download progress and status",
    responses={
        404: {"description": "Job ID not found"},
    },
)
async def get_download_progress(job_id: str) -> DownloadProgressResponse:
    """Retrieve progress metrics and status for a download job."""
    progress = download_service.get_progress(job_id)
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Download job '{job_id}' not found",
        )
    return progress


@router.get(
    "/{job_id}/file",
    summary="Download the completed media file",
    responses={
        404: {"description": "File or job not found"},
        400: {"description": "Download has not completed yet or failed"},
    },
)
async def get_downloaded_file(job_id: str):
    """Serve the completed media file for browser download."""
    progress = download_service.get_progress(job_id)
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Download job '{job_id}' not found",
        )

    if progress.status.value != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job '{job_id}' is not completed yet (status: {progress.status.value})",
        )

    file_path = download_service.get_job_file(job_id)
    if not file_path or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requested file does not exist on server",
        )

    # Determine media type
    media_type, _ = mimetypes.guess_type(file_path.name)
    if not media_type:
        media_type = "application/octet-stream"

    # User friendly filename: strip job prefix if present
    filename = file_path.name
    if filename.startswith(f"{job_id}_"):
        clean_filename = filename[len(f"{job_id}_") :]
    else:
        clean_filename = filename

    logger.info("Serving file for job %s: %s (%s)", job_id, clean_filename, media_type)

    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=clean_filename,
    )
