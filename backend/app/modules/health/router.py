"""/health 放根路徑：不受 /api/v1 預設驗證影響。走完整分層，兼作組員範例。"""

from fastapi import APIRouter, Depends, Response, status

from app.core.errors import ErrorResponse
from app.modules.health.dependencies import get_health_service
from app.modules.health.schemas import HealthResponse
from app.modules.health.service import HealthService

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    responses={
        status.HTTP_503_SERVICE_UNAVAILABLE: {"model": HealthResponse},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ErrorResponse},
    },
)
def read_health(
    response: Response,
    service: HealthService = Depends(get_health_service),
) -> HealthResponse:
    report = service.check()
    if report.status != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthResponse(status=report.status, database=report.database)
