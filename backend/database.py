"""
Database initialization and connection management for GridWind DA.
Uses SQLite for zero-dependency, ultra-fast local storage.
"""

import sqlite3
import os
from contextlib import contextmanager

DB_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.path.join(DB_DIR, "gridwind.db")

os.makedirs(DB_DIR, exist_ok=True)

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    """Create tables and indexes if they do not exist."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Actuals table (from FUELHH, WIND fuelType)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS actuals (
                start_time TEXT PRIMARY KEY,
                settlement_date TEXT NOT NULL,
                settlement_period INTEGER NOT NULL,
                publish_time TEXT,
                generation REAL NOT NULL
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_actuals_date ON actuals (settlement_date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_actuals_sp ON actuals (settlement_period);")
        
        # Forecasts table (from WINDFOR stream)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS forecasts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                publish_time TEXT NOT NULL,
                start_time TEXT NOT NULL,
                generation REAL NOT NULL,
                UNIQUE(publish_time, start_time)
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_forecasts_pub ON forecasts (publish_time);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_forecasts_start ON forecasts (start_time);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_forecasts_pub_start ON forecasts (publish_time, start_time);")
        
        # Metadata / Sync tracking
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        conn.commit()

if __name__ == "__main__":
    init_db()
    print(f"Database initialized at {DB_PATH}")
