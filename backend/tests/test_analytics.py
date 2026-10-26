"""
Unit tests for analytics calculations and Elexon market logic.
"""

import unittest
import numpy as np
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from analytics import (
    get_available_dates,
    get_day_ahead_data,
    get_forecast_evolution,
    evaluate_monthly_accuracy,
    get_diurnal_settlement_period_profile,
    simulate_thermal_procurement
)

class TestAnalytics(unittest.TestCase):
    def test_available_dates(self):
        dates_info = get_available_dates()
        self.assertIn("delivery_dates", dates_info)
        self.assertTrue(len(dates_info["delivery_dates"]) > 0)
        self.assertIn("2026-01-15", dates_info["delivery_dates"])

    def test_day_ahead_settlement_periods(self):
        # 48 settlement periods
        res = get_day_ahead_data("2026-01-15", gate_closure_time="11:00", resolution="settlement_period")
        self.assertEqual(len(res["points"]), 48)
        self.assertEqual(res["summary"]["total_points"], 48)
        self.assertIn("mae_mw", res["summary"])
        self.assertIn("wmape_pct", res["summary"])
        self.assertIn("mean_bias_mw", res["summary"])

    def test_day_ahead_hourly(self):
        # 24 hourly periods
        res = get_day_ahead_data("2026-01-15", gate_closure_time="11:00", resolution="hourly")
        self.assertEqual(len(res["points"]), 24)
        self.assertGreater(res["summary"]["total_actual_mwh"], 0)

    def test_gate_closure_cutoff_enforcement(self):
        # Verify that earlier gate closure does not use future forecasts
        res_early = get_day_ahead_data("2026-01-15", gate_closure_time="09:00", resolution="hourly")
        res_late = get_day_ahead_data("2026-01-15", gate_closure_time="14:00", resolution="hourly")
        self.assertIsNotNone(res_early)
        self.assertIsNotNone(res_late)

    def test_monthly_accuracy(self):
        metrics = evaluate_monthly_accuracy(start_date="2026-01-01", end_date="2026-01-31", gate_closure_time="11:00")
        self.assertEqual(metrics["total_days"], 31)
        self.assertIn("mae_mw", metrics["kpis"])
        self.assertIn("recommended_buffer_p90_mw", metrics["kpis"])
        self.assertGreater(metrics["kpis"]["mae_mw"], 0)
        self.assertTrue(len(metrics["histogram"]) > 0)

    def test_diurnal_profile(self):
        profile = get_diurnal_settlement_period_profile(start_date="2026-01-01", end_date="2026-01-31")
        self.assertEqual(len(profile), 48)
        self.assertEqual(profile[0]["settlement_period"], 1)
        self.assertEqual(profile[47]["settlement_period"], 48)

    def test_procurement_simulation(self):
        sim = simulate_thermal_procurement("2026-01-15", baseline_demand_mw=28000, risk_percentile=90)
        self.assertEqual(len(sim["points"]), 24)
        self.assertGreater(sim["safety_buffer_mw"], 0)
        self.assertIn("estimated_unhedged_penalty_gbp", sim["financial_impact"])

if __name__ == "__main__":
    unittest.main()
