from pathlib import Path

from dotenv import load_dotenv

# Load the project .env before service modules initialize so provider singletons
# pick up credentials consistently in uvicorn and reload subprocesses.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
