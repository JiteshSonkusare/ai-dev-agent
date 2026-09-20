import os
from pydantic_settings import BaseSettings, SettingsConfigDict


def _get_env_file() -> str:
    """Load .env.development or .env.production based on ENV variable."""
    env = os.getenv("ENV", "development")
    env_file = f".env.{env}"
    if os.path.exists(env_file):
        return env_file
    # Fallback to .env.development
    return ".env.development"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_get_env_file(), env_file_encoding="utf-8", extra="ignore")

    env: str = "development"
    app_base_url: str = "http://localhost:8000"

    # API security
    api_key: str = ""

    # Database — Azure SQL (MS SQL)
    database_url: str = "mssql+aioodbc://sqladmin:AiDevAgent%402026!@aidevagent-sql.database.windows.net/aidevagent_db?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no"

    # Encryption key for credentials (Fernet)
    encryption_key: str = ""

    # Session
    session_secret: str = "change-me-in-production"
    session_expire_hours: int = 24

    # Agent workspace
    workspace_base_path: str = "/tmp/agent-workspace"

    # Azure AD (optional SSO)
    azure_ad_client_id: str = ""
    azure_ad_client_secret: str = ""
    azure_ad_tenant_id: str = ""

    @property
    def is_production(self) -> bool:
        return self.env == "production"


settings = Settings()
