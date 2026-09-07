import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.models import JobStatus
from app.services.download_service import download_service, JobRecord


client = TestClient(app)


def test_health_check():
    """Verify health endpoint returns status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_video_info_invalid_url():
    """Verify endpoint rejects invalid or non-YouTube URLs."""
    # Empty string
    res1 = client.post("/api/video/info", json={"url": ""})
    assert res1.status_code == 422

    # Non-YouTube URL
    res2 = client.post("/api/video/info", json={"url": "https://example.com/not-a-video"})
    assert res2.status_code == 422


@patch("yt_dlp.YoutubeDL")
def test_video_info_success(mock_ydl_class):
    """Verify valid YouTube URL returns formatted metadata."""
    mock_instance = MagicMock()
    mock_ydl_class.return_value.__enter__.return_value = mock_instance

    mock_instance.extract_info.return_value = {
        "id": "dQw4w9WgXcQ",
        "title": "Never Gonna Give You Up",
        "uploader": "Rick Astley",
        "duration": 212,
        "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        "formats": [
            {
                "format_id": "18",
                "ext": "mp4",
                "height": 360,
                "vcodec": "avc1.42001E",
                "acodec": "mp4a.40.2",
                "fps": 30,
                "filesize": 15000000,
            },
            {
                "format_id": "137",
                "ext": "mp4",
                "height": 1080,
                "vcodec": "avc1.640028",
                "acodec": "none",
                "fps": 30,
                "filesize": 50000000,
            },
            {
                "format_id": "140",
                "ext": "m4a",
                "vcodec": "none",
                "acodec": "mp4a.40.2",
                "filesize": 3500000,
            },
        ],
    }

    response = client.post(
        "/api/video/info",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "dQw4w9WgXcQ"
    assert data["title"] == "Never Gonna Give You Up"
    assert data["channel"] == "Rick Astley"
    assert data["duration_formatted"] == "03:32"
    assert len(data["formats"]) >= 2
    # Check that audio option exists
    audio_formats = [f for f in data["formats"] if f["type"] == "audio"]
    assert len(audio_formats) > 0


@patch("yt_dlp.YoutubeDL")
def test_video_info_extraction_failure(mock_ydl_class):
    """Verify extraction errors return a clean 502 error."""
    mock_instance = MagicMock()
    mock_ydl_class.return_value.__enter__.return_value = mock_instance
    mock_instance.extract_info.side_effect = Exception("Video unavailable")

    response = client.post(
        "/api/video/info",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
    )
    assert response.status_code == 502
    assert "Unable to retrieve video information" in response.json()["detail"]


@patch.object(download_service, "_run_download")
def test_start_download_success(mock_run):
    """Verify download endpoint initiates a background job."""
    payload = {
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "format_id": "18",
        "download_type": "video",
        "quality": "360p",
    }
    response = client.post("/api/download", json=payload)
    assert response.status_code == 202
    data = response.json()
    assert "job_id" in data
    assert len(data["job_id"]) > 0


def test_start_download_invalid_url():
    """Verify download endpoint rejects invalid URL."""
    payload = {
        "url": "https://malicious.com/exploit",
        "format_id": "18",
        "download_type": "video",
    }
    response = client.post("/api/download", json=payload)
    assert response.status_code == 422


def test_download_progress_unknown_job():
    """Verify 404 for unknown job ID."""
    response = client.get("/api/download/nonexistent123/progress")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_download_progress_existing_job():
    """Verify progress endpoint returns correct metrics for registered job."""
    test_job_id = "test_job_999"
    download_service._jobs[test_job_id] = JobRecord(
        job_id=test_job_id,
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        format_id="18",
        download_type="video",
        status=JobStatus.DOWNLOADING,
        progress=45.5,
        downloaded_bytes=45000,
        total_bytes=100000,
        speed="1.2MiB/s",
        eta="00:05",
        filename="test.mp4",
    )

    response = client.get(f"/api/download/{test_job_id}/progress")
    assert response.status_code == 200
    data = response.json()
    assert data["job_id"] == test_job_id
    assert data["status"] == "downloading"
    assert data["progress"] == 45.5
    assert data["speed"] == "1.2MiB/s"


def test_download_file_not_ready():
    """Verify downloading file before completion returns 400."""
    test_job_id = "test_job_incomplete"
    download_service._jobs[test_job_id] = JobRecord(
        job_id=test_job_id,
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        format_id="18",
        download_type="video",
        status=JobStatus.DOWNLOADING,
    )

    response = client.get(f"/api/download/{test_job_id}/file")
    assert response.status_code == 400
    assert "not completed yet" in response.json()["detail"]


def test_download_file_path_traversal_protection(tmp_path):
    """Verify path traversal attempts are blocked."""
    # Attempting path outside download directory
    outside_file = tmp_path / "secret.txt"
    outside_file.write_text("classified data")

    test_job_id = "test_exploit"
    download_service._jobs[test_job_id] = JobRecord(
        job_id=test_job_id,
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        format_id="18",
        download_type="video",
        status=JobStatus.COMPLETED,
        file_path=outside_file,  # Outside DOWNLOAD_DIR
    )

    response = client.get(f"/api/download/{test_job_id}/file")
    # Should reject with 404 because get_job_file returns None due to path safety check
    assert response.status_code == 404
