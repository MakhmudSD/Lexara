"""One-off script: re-embed all workspace chunks into FAISS using current model."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import get_settings
from app.services.faiss_rebuild import rebuild_faiss_from_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

settings = get_settings()
engine = create_engine(settings.database_url)
Session = sessionmaker(bind=engine)

with Session() as db:
    count = rebuild_faiss_from_db(db, settings)
    print(f"Rebuilt FAISS for {count} workspace(s) using model: {settings.local_embedding_model}")
