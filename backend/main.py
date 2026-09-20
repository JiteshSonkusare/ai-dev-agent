from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import init_db
from app.api.routes.auth import router as auth_router
from app.api.routes.connections import router as connections_router
from app.api.routes.skill_content import router as skill_content_router
from app.api.routes.tasks import router as tasks_router
from app.api.routes.dashboard import router as dashboard_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="AI DevAgent", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth + Admin
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

# User-scoped routes
app.include_router(connections_router, prefix="/api", tags=["connections"])
app.include_router(skill_content_router, prefix="/api", tags=["skills"])
app.include_router(tasks_router, prefix="/api", tags=["tasks"])
app.include_router(dashboard_router, prefix="/api", tags=["dashboard"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
