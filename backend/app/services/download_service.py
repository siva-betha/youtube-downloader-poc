import logging
import os
import re
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional

import yt_dlp

from app.config import settings
from app.models import DownloadProgressResponse, JobStatus

logger = logging.getLogger(__name__)


def sanitize_filename(name: str) -> str:
    """Sanitize filename to prevent directory traversal and illegal characters."""
    # Keep only alphanumeric, dashes, dots, underscores
    cleaned = re.sub(r"[^\w\s\.-]", "", name)
    cleaned = re.sub(r"[\s]+", "_", cleaned).strip("._")
    return cleaned or "downloaded_media"


@dataclass
class JobRecord:
    job_id: str
    url: str
    download_type: str
    format_id: str
    quality: Optional[str] = None
    status: JobStatus = JobStatus.QUEUED
    progress: float = 0.0
    downloaded_bytes: Optional[int] = None
    total_bytes: Optional[int] = None
    speed: Optional[str] = None
    eta: Optional[str] = None
    filename: Optional[str] = None
    file_path: Optional[Path] = None
    download_url: Optional[str] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None


class DownloadService:
    """Service to handle background downloads with progress tracking and cleanup."""

    def __init__(self) -> None:
        self._jobs: Dict[str, JobRecord] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(
            max_workers=settings.MAX_CONCURRENT_DOWNLOADS,
            thread_name_prefix="DownloadWorker",
        )

    def create_job(
        self,
        url: str,
        format_id: str,
        download_type: str = "video",
        quality: Optional[str] = None,
    ) -> str:
        """Create and queue a download job, returning the unique job_id."""
        job_id = uuid.uuid4().hex[:12]
        record = JobRecord(
            job_id=job_id,
            url=url,
            format_id=format_id,
            download_type=download_type,
            quality=quality,
            status=JobStatus.QUEUED,
        )

        with self._lock:
            self._jobs[job_id] = record

        logger.info("Created download job %s for URL: %s", job_id, url)
        self._executor.submit(self._run_download, job_id)
        return job_id

    def get_progress(self, job_id: str) -> Optional[DownloadProgressResponse]:
        """Get current progress and status for a given job_id."""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None

            return DownloadProgressResponse(
                job_id=job.job_id,
                status=job.status,
                progress=round(job.progress, 1),
                downloaded_bytes=job.downloaded_bytes,
                total_bytes=job.total_bytes,
                speed=job.speed,
                eta=job.eta,
                filename=job.filename,
                download_url=job.download_url,
                error=job.error,
            )

    def get_job_file(self, job_id: str) -> Optional[Path]:
        """Safely retrieve the Path to the downloaded file for a completed job."""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                logger.warning("Job %s not found in get_job_file", job_id)
                return None

            if job.status != JobStatus.COMPLETED or not job.file_path:
                logger.warning("Job %s is not completed or has no file path", job_id)
                return None

            file_path = job.file_path.resolve()
            base_dir = settings.DOWNLOAD_DIR.resolve()

            # Security: Path traversal prevention
            try:
                file_path.relative_to(base_dir)
            except ValueError:
                logger.error("Security violation: job %s path %s escapes %s", job_id, file_path, base_dir)
                return None

            if not file_path.is_file():
                logger.warning("Job %s file %s does not exist on disk", job_id, file_path)
                return None

            return file_path

    def _update_job(self, job_id: str, **kwargs: Any) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job:
                for k, v in kwargs.items():
                    setattr(job, k, v)

    def _progress_hook(self, job_id: str, d: Dict[str, Any]) -> None:
        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0

            percent = 0.0
            if total > 0:
                percent = (downloaded / total) * 100.0
            else:
                percent_str = d.get("_percent_str", "0%").replace("%", "").strip()
                try:
                    percent = float(percent_str)
                except ValueError:
                    percent = 0.0

            speed_str = d.get("_speed_str")
            eta_str = d.get("_eta_str")
            filename = os.path.basename(d.get("filename") or "")

            self._update_job(
                job_id,
                status=JobStatus.DOWNLOADING,
                progress=min(percent, 99.0),
                downloaded_bytes=downloaded,
                total_bytes=total if total > 0 else None,
                speed=speed_str.strip() if speed_str else None,
                eta=eta_str.strip() if eta_str else None,
                filename=filename or None,
            )
        elif status == "finished":
            self._update_job(
                job_id,
                status=JobStatus.PROCESSING,
                progress=99.0,
                eta="processing...",
            )

    def _run_download(self, job_id: str) -> None:
        """Worker thread executing yt-dlp download."""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            url = job.url
            format_id = job.format_id
            download_type = job.download_type
            quality = job.quality

        logger.info("Starting download for job %s (type=%s, format=%s)", job_id, download_type, format_id)
        self._update_job(job_id, status=JobStatus.DOWNLOADING, progress=1.0)

        out_template = str(settings.DOWNLOAD_DIR / f"{job_id}_%(title).50s.%(ext)s")

        ydl_opts: Dict[str, Any] = {
            "outtmpl": out_template,
            "quiet": True,
            "no_warnings": True,
            "progress_hooks": [lambda d: self._progress_hook(job_id, d)],
            "socket_timeout": 30,
            "restrictfilenames": True,
        }

        if download_type == "audio":
            ydl_opts["format"] = "bestaudio/best"
            ydl_opts["postprocessors"] = [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }
            ]
        else:
            # Video download
            # Format selection: combine selected video stream with best audio, merge to mp4
            if quality and quality.replace("p", "").isdigit():
                height = int(quality.replace("p", ""))
                format_spec = f"{format_id}+bestaudio/bestvideo[height<={height}]+bestaudio/best[height<={height}][ext=mp4]/best"
            else:
                format_spec = f"{format_id}+bestaudio/bestvideo+bestaudio/best[ext=mp4]/best"

            ydl_opts["format"] = format_spec
            ydl_opts["merge_output_format"] = "mp4"

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)

            # Locate downloaded output file matching job_id prefix
            download_dir = settings.DOWNLOAD_DIR.resolve()
            matching_files = list(download_dir.glob(f"{job_id}_*"))

            if not matching_files:
                raise RuntimeError("Download completed but output file could not be found on disk.")

            # Pick matching file with latest modification time
            matching_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
            output_file = matching_files[0]

            filename = output_file.name
            logger.info("Job %s completed successfully: %s", job_id, filename)

            self._update_job(
                job_id,
                status=JobStatus.COMPLETED,
                progress=100.0,
                filename=filename,
                file_path=output_file,
                download_url=f"/api/download/{job_id}/file",
                completed_at=time.time(),
                eta=None,
                speed=None,
            )

        except Exception as e:
            err_msg = str(e)
            logger.error("Download failed for job %s: %s", job_id, err_msg)
            self._update_job(
                job_id,
                status=JobStatus.FAILED,
                error=f"Download failed: {err_msg}",
            )

    def cleanup_old_files(self) -> int:
        """Remove completed files and jobs older than FILE_RETENTION_MINUTES."""
        retention_seconds = settings.FILE_RETENTION_MINUTES * 60
        now = time.time()
        deleted_count = 0

        # 1. Clean jobs from memory and their associated files
        with self._lock:
            expired_job_ids = [
                jid
                for jid, job in self._jobs.items()
                if job.completed_at and (now - job.completed_at) > retention_seconds
            ]
            for jid in expired_job_ids:
                job = self._jobs.pop(jid, None)
                if job and job.file_path and job.file_path.exists():
                    try:
                        job.file_path.unlink(missing_ok=True)
                        deleted_count += 1
                        logger.info("Cleaned up expired job file: %s", job.file_path)
                    except Exception as e:
                        logger.warning("Error deleting file %s: %s", job.file_path, e)

        # 2. Also clean orphaned files in download directory older than retention period
        try:
            download_dir = settings.DOWNLOAD_DIR.resolve()
            if download_dir.exists():
                for f in download_dir.iterdir():
                    if f.is_file() and not f.name.startswith("."):
                        file_age = now - f.stat().st_mtime
                        if file_age > retention_seconds:
                            try:
                                f.unlink(missing_ok=True)
                                deleted_count += 1
                                logger.info("Cleaned up orphaned file: %s", f.name)
                            except Exception as e:
                                logger.warning("Error deleting orphaned file %s: %s", f.name, e)
        except Exception as e:
            logger.warning("Error during directory cleanup: %s", e)

        return deleted_count


# Global singleton service instance
download_service = DownloadService()
