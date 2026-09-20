from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: str = "development"
    app_base_url: str = "http://localhost:8000"

    # API security
    api_key: str = ""

    # Database — SQLite for local dev, MS SQL for production
    # MS SQL: mssql+aioodbc://sa:Pass@localhost\\SQLEXPRESS/devagent_db?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes
    database_url: str = "sqlite+aiosqlite:///./cc_automation.db"

    # Encryption key for credentials (Fernet)
    encryption_key: str = ""

    # Session
    session_secret: str = "change-me-in-production"
    session_expire_hours: int = 24

    # Agent workspace — where repos are cloned for task execution
    workspace_base_path: str = "/tmp/agent-workspace"

    # Azure AD (optional SSO)
    azure_ad_client_id: str = ""
    azure_ad_client_secret: str = ""
    azure_ad_tenant_id: str = ""

    @property
    def is_production(self) -> bool:
        return self.env == "production"


settings = Settings()
