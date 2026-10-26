"""
Elexon BMRS API Client for FUELHH (Actuals) and WINDFOR (Forecasts).
Interacts directly with the official Elexon Insights Solution REST API:
- FUELHH stream: https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream
- WINDFOR stream: https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream
"""

import logging
import time
from typing import List, Dict, Any, Optional
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

ELEXON_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"

class ElexonClient:
    def __init__(self, timeout: int = 45, max_retries: int = 3, retry_delay: float = 2.0):
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "GridWind-DA-DecisionSupport/1.0 (UK-Energy-Procurement)",
            "Accept": "application/json"
        })

    def _get_with_retry(self, url: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Executes GET request with exponential backoff retry."""
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(f"Elexon GET request (attempt {attempt}/{self.max_retries}): {url} params={params}")
                resp = self.session.get(url, params=params, timeout=self.timeout)
                if resp.status_code == 200:
                    data = resp.json()
                    logger.info(f"Success: received {len(data)} records")
                    return data
                elif resp.status_code == 429:
                    wait_time = self.retry_delay * (2 ** attempt)
                    logger.warning(f"Rate limited (429). Backing off for {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"Elexon API returned status {resp.status_code}: {resp.text[:200]}")
                    resp.raise_for_status()
            except Exception as e:
                last_error = e
                logger.warning(f"Attempt {attempt} failed: {e}")
                if attempt < self.max_retries:
                    time.sleep(self.retry_delay * attempt)
        raise RuntimeError(f"Failed to fetch data from Elexon after {self.max_retries} attempts: {last_error}")

    def fetch_actuals_fuelhh(self, settlement_date_from: str, settlement_date_to: str) -> List[Dict[str, Any]]:
        """
        Fetches half-hourly generation by fuel type from FUELHH stream.
        Filters specifically for fuelType == 'WIND'.
        
        Args:
            settlement_date_from: YYYY-MM-DD
            settlement_date_to: YYYY-MM-DD
        Returns:
            List of wind actuals records
        """
        url = f"{ELEXON_BASE_URL}/FUELHH/stream"
        params = {
            "settlementDateFrom": settlement_date_from,
            "settlementDateTo": settlement_date_to
        }
        raw_records = self._get_with_retry(url, params=params)
        
        # Filter for WIND and normalize
        wind_records = []
        for r in raw_records:
            if r.get("fuelType") == "WIND":
                wind_records.append({
                    "start_time": r.get("startTime"),
                    "settlement_date": r.get("settlementDate"),
                    "settlement_period": int(r.get("settlementPeriod", 0)),
                    "publish_time": r.get("publishTime"),
                    "generation": float(r.get("generation", 0.0))
                })
        logger.info(f"Filtered {len(wind_records)} WIND actuals from {len(raw_records)} FUELHH records.")
        return wind_records

    def fetch_forecasts_windfor_chunk(self, publish_datetime_from: str, publish_datetime_to: str) -> List[Dict[str, Any]]:
        """
        Fetches wind forecasts from WINDFOR stream published between given ISO timestamps.
        
        Args:
            publish_datetime_from: e.g. 2026-01-01T00:00:00Z
            publish_datetime_to: e.g. 2026-01-05T00:00:00Z
        Returns:
            List of forecast records
        """
        url = f"{ELEXON_BASE_URL}/WINDFOR/stream"
        params = {
            "publishDateTimeFrom": publish_datetime_from,
            "publishDateTimeTo": publish_datetime_to
        }
        raw_records = self._get_with_retry(url, params=params)
        
        forecast_records = []
        for r in raw_records:
            forecast_records.append({
                "publish_time": r.get("publishTime"),
                "start_time": r.get("startTime"),
                "generation": float(r.get("generation", 0.0))
            })
        return forecast_records

if __name__ == "__main__":
    client = ElexonClient()
    actuals = client.fetch_actuals_fuelhh("2026-01-01", "2026-01-02")
    print(f"Sample actual: {actuals[0] if actuals else 'None'}")
