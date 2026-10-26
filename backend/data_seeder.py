"""
Data seeder script for January 2026 UK Wind Power Actuals and Forecasts.
Populates local SQLite database with authentic Elexon data.
Supports offline fallback and caching.
"""

import sys
import os
import logging
from datetime import datetime, timedelta
from database import init_db, get_db
from elexon_client import ElexonClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

def seed_actuals(client: ElexonClient):
    """Fetches and inserts actual wind generation for Jan 1 to Feb 1, 2026."""
    logger.info("Fetching Actuals (FUELHH) for 2026-01-01 through 2026-02-01...")
    actuals = client.fetch_actuals_fuelhh("2026-01-01", "2026-02-01")
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.executemany("""
            INSERT OR REPLACE INTO actuals (start_time, settlement_date, settlement_period, publish_time, generation)
            VALUES (:start_time, :settlement_date, :settlement_period, :publish_time, :generation)
        """, actuals)
        cursor.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('actuals_count', ?)", (len(actuals),))
        conn.commit()
    logger.info(f"Successfully stored {len(actuals)} wind actual generation records.")

def seed_forecasts(client: ElexonClient):
    """
    Fetches and inserts WINDFOR forecast runs published from 2025-12-30 to 2026-01-31.
    Uses 4-day sliding windows to ensure reliable delivery without timeouts.
    """
    logger.info("Fetching Forecasts (WINDFOR) for purchase decisions in January 2026...")
    
    start_dt = datetime(2025, 12, 30, 0, 0, 0)
    end_dt = datetime(2026, 2, 1, 0, 0, 0)
    step = timedelta(days=4)
    
    total_inserted = 0
    curr_start = start_dt
    
    while curr_start < end_dt:
        curr_end = min(curr_start + step, end_dt)
        from_str = curr_start.strftime("%Y-%m-%dT%H:%M:%SZ")
        to_str = curr_end.strftime("%Y-%m-%dT%H:%M:%SZ")
        
        logger.info(f"Fetching WINDFOR window: {from_str} -> {to_str}")
        try:
            records = client.fetch_forecasts_windfor_chunk(from_str, to_str)
            if records:
                with get_db() as conn:
                    cursor = conn.cursor()
                    cursor.executemany("""
                        INSERT OR IGNORE INTO forecasts (publish_time, start_time, generation)
                        VALUES (:publish_time, :start_time, :generation)
                    """, records)
                    conn.commit()
                total_inserted += len(records)
                logger.info(f"Inserted {len(records)} forecasts (Cumulative: {total_inserted})")
        except Exception as e:
            logger.error(f"Error fetching chunk {from_str} to {to_str}: {e}")
        
        curr_start = curr_end

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM forecasts")
        count = cursor.fetchone()[0]
        cursor.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('forecasts_count', ?)", (count,))
        cursor.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_seeded_at', ?)", (datetime.utcnow().isoformat() + "Z",))
        conn.commit()
    logger.info(f"WINDFOR seeding complete! Total unique forecast records in DB: {count}")

def main():
    init_db()
    client = ElexonClient()
    seed_actuals(client)
    seed_forecasts(client)
    logger.info("Database seeding successfully completed!")

if __name__ == "__main__":
    main()
