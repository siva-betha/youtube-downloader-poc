import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models import HealthResponse
from app.routes import download, video
from app.services.download_service import download_service

# Setup logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def periodic_cleanup_task(interval_seconds: int = 300) -> None:
    """Periodically clean up downloaded files exceeding the retention limit."""
    logger.info("Starting background file cleanup task (interval: %ds)", interval_seconds)
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            deleted = download_service.cleanup_old_files()
            if deleted > 0:
                logger.info("Background cleanup removed %d expired file(s)", deleted)
        except asyncio.CancelledError:
            logger.info("Background cleanup task cancelled.")
            break
        except Exception as e:
            logger.warning("Error in background cleanup loop: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for startup and shutdown procedures."""
    logger.info("Starting YouTube Downloader POC API...")
    logger.info("Download directory: %s", settings.DOWNLOAD_DIR)
    logger.info("Allowed CORS origins: %s", settings.CORS_ORIGINS)

    # Launch background cleanup task
    cleanup_task = asyncio.create_task(periodic_cleanup_task())

    yield

    logger.info("Shutting down YouTube Downloader POC API...")
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="YouTube Downloader POC API",
    description="Proof of Concept API for inspecting YouTube metadata and downloading authorized media.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(video.router)
app.include_router(download.router)


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Application health check",
)
async def health_check() -> HealthResponse:
    """Return health status of the application."""
    return HealthResponse(status="ok")
