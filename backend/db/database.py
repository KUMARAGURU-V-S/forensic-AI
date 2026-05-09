"""
SQLAlchemy SQLite database engine.
Zero-config: creates forensic.db in the project root on first startup.
"""
import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

# DB file lives next to the project root
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.environ.get("DB_PATH", os.path.join(_ROOT, "forensic.db"))

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
    echo=False,
)

# Enable WAL mode for concurrent reads
@event.listens_for(engine, "connect")
def set_wal(dbapi_conn, conn_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Called at application startup."""
    from backend.db.models import Base  # noqa — import triggers model registration
    Base.metadata.create_all(engine)
    print(f"[DB] SQLite database initialised at {DB_PATH}")
