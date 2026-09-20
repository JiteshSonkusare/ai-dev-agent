from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import init_db
from app.api.routes.auth import router as auth_router
from app.api.routes.orgs import router as orgs_router
from app.api.routes.projects import router as projects_router
from app.api.routes.connections import router as connections_router
from app.api.routes.skills import router as skills_router
from app.api.routes.workflows import router as workflows_router
from app.api.routes.runs import router as runs_router
from app.api.routes.batch_run import router as batch_run_router
from app.api.routes.skill_content import router as skill_content_router
from app.api.routes.tasks import router as tasks_router
from app.api.routes.dashboard import router as dashboard_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Agentic AI Development Platform", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public routes
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

# Protected routes
app.include_router(orgs_router, prefix="/api/orgs", tags=["orgs"])
app.include_router(projects_router, prefix="/api", tags=["projects"])
app.include_router(connections_router, prefix="/api", tags=["connections"])
app.include_router(skills_router, prefix="/api", tags=["skills"])
app.include_router(workflows_router, prefix="/api", tags=["workflows"])
app.include_router(runs_router, prefix="/api", tags=["runs"])
app.include_router(batch_run_router, prefix="/api/workflow", tags=["batch-run"])
app.include_router(skill_content_router, prefix="/api", tags=["skill-content"])
app.include_router(tasks_router, prefix="/api", tags=["tasks"])
app.include_router(dashboard_router, prefix="/api", tags=["dashboard"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
