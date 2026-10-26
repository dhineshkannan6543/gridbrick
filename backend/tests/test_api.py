"""
Integration tests for FastAPI REST API endpoints.
"""

import unittest
import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app

class TestAPIEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "healthy")

    def test_system_status(self):
        res = self.client.get("/api/system-status")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data["actuals_records"], 0)
        self.assertGreater(data["forecast_records"], 0)

    def test_dates(self):
        res = self.client.get("/api/dates")
        self.assertEqual(res.status_code, 200)
        self.assertIn("delivery_dates", res.json())

    def test_overview(self):
        res = self.client.get("/api/overview")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("kpis", data)
        self.assertIn("mae_mw", data["kpis"])

    def test_day_ahead(self):
        res = self.client.get("/api/day-ahead?delivery_date=2026-01-15&cutoff_time=11:00&resolution=settlement_period")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()["points"]), 48)

    def test_forecast_evolution(self):
        res = self.client.get("/api/forecast-evolution?delivery_date=2026-01-15")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()["points"]), 24)

    def test_accuracy_metrics(self):
        res = self.client.get("/api/accuracy-metrics?cutoff_time=11:00")
        self.assertEqual(res.status_code, 200)
        self.assertIn("histogram", res.json())

    def test_settlement_periods(self):
        res = self.client.get("/api/settlement-periods")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 48)

    def test_procurement_simulation(self):
        res = self.client.get("/api/procurement-simulation?delivery_date=2026-01-15&baseline_demand_mw=28000&risk_percentile=90")
        self.assertEqual(res.status_code, 200)
        self.assertIn("financial_impact", res.json())

if __name__ == "__main__":
    unittest.main()
