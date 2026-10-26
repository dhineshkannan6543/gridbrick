"""
Analytics and Quantitative Evaluation Engine for UK Wind Power Day-Ahead Decisions.
Implements energy-market-grade metrics, alignment logic, and risk hedging algorithms.
"""

import math
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import numpy as np
from database import get_db

# Standard UK Day-Ahead auction gate closure: 11:00 GMT (EPEX Spot) / 12:00 GMT
DEFAULT_GATE_CLOSURE = "11:00"

def parse_iso(dt_str: str) -> datetime:
    """Parses standard ISO timestamps with Z."""
    clean = dt_str.replace("Z", "+00:00")
    return datetime.fromisoformat(clean)

def get_available_dates() -> Dict[str, Any]:
    """Returns list of distinct delivery and decision dates in the dataset."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT settlement_date FROM actuals ORDER BY settlement_date")
        dates = [row[0] for row in cursor.fetchall()]
        
        # Valid decision dates are D-1 for any delivery date
        return {
            "delivery_dates": dates,
            "min_date": dates[0] if dates else "2026-01-01",
            "max_date": dates[-1] if dates else "2026-01-31",
            "default_date": "2026-01-15" if "2026-01-15" in dates else (dates[0] if dates else "2026-01-01")
        }

def get_day_ahead_data(
    delivery_date: str,
    gate_closure_time: str = DEFAULT_GATE_CLOSURE,
    resolution: str = "settlement_period"
) -> Dict[str, Any]:
    """
    Computes the Day-Ahead operational view for a target delivery day D.
    Enforces gate closure: only uses forecasts published strictly on or before D-1 at gate_closure_time.
    
    Args:
        delivery_date: YYYY-MM-DD
        gate_closure_time: HH:MM (e.g. "11:00" or "12:00")
        resolution: "settlement_period" (48 half-hours) or "hourly" (24 hours)
    """
    deliv_dt = datetime.strptime(delivery_date, "%Y-%m-%d")
    decision_dt = deliv_dt - timedelta(days=1)
    decision_date_str = decision_dt.strftime("%Y-%m-%d")
    cutoff_iso = f"{decision_date_str}T{gate_closure_time}:00Z"
    
    deliv_start_iso = f"{delivery_date}T00:00:00Z"
    deliv_end_iso = (deliv_dt + timedelta(days=1)).strftime("%Y-%m-%d") + "T00:00:00Z"
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Fetch Actuals for delivery date (48 half-hours)
        cursor.execute("""
            SELECT start_time, settlement_period, generation
            FROM actuals
            WHERE settlement_date = ?
            ORDER BY settlement_period ASC
        """, (delivery_date,))
        actual_rows = cursor.fetchall()
        actuals_by_sp = {row["settlement_period"]: row["generation"] for row in actual_rows}
        actuals_by_start = {row["start_time"]: row["generation"] for row in actual_rows}
        
        # 2. Fetch Latest Forecast published on or before cutoff for delivery date
        query_forecasts = """
            SELECT f.start_time, f.generation, f.publish_time
            FROM forecasts f
            INNER JOIN (
                SELECT start_time, MAX(publish_time) as max_pub
                FROM forecasts
                WHERE publish_time <= ? AND start_time >= ? AND start_time < ?
                GROUP BY start_time
            ) latest ON f.start_time = latest.start_time AND f.publish_time = latest.max_pub
            ORDER BY f.start_time ASC
        """
        cursor.execute(query_forecasts, (cutoff_iso, deliv_start_iso, deliv_end_iso))
        forecast_rows = cursor.fetchall()
        forecasts_by_start = {row["start_time"]: {"gen": row["generation"], "pub": row["publish_time"]} for row in forecast_rows}

    # If hourly resolution: 24 points (Hour 0 to 23)
    # If settlement_period: 48 points (SP 1 to 48)
    points = []
    errors = []
    abs_errors = []
    
    latest_pub_observed = None
    
    if resolution == "hourly":
        for h in range(24):
            hour_start_iso = f"{delivery_date}T{h:02d}:00:00Z"
            f_info = forecasts_by_start.get(hour_start_iso)
            f_gen = f_info["gen"] if f_info else None
            if f_info and (latest_pub_observed is None or f_info["pub"] > latest_pub_observed):
                latest_pub_observed = f_info["pub"]
                
            # Actual generation for hour h is the average of SP 2h+1 and SP 2h+2
            sp1 = h * 2 + 1
            sp2 = h * 2 + 2
            a1 = actuals_by_sp.get(sp1)
            a2 = actuals_by_sp.get(sp2)
            if a1 is not None and a2 is not None:
                a_gen = round((a1 + a2) / 2.0, 1)
            else:
                a_gen = a1 if a1 is not None else a2
                
            err = round(f_gen - a_gen, 1) if (f_gen is not None and a_gen is not None) else None
            abs_err = abs(err) if err is not None else None
            pct_err = round((abs_err / a_gen) * 100, 1) if (abs_err is not None and a_gen and a_gen > 0) else None
            
            if err is not None:
                errors.append(err)
                abs_errors.append(abs_err)
                
            points.append({
                "time_label": f"{h:02d}:00",
                "start_time": hour_start_iso,
                "hour": h,
                "sp_range": f"SP {sp1}-{sp2}",
                "forecast_mw": f_gen,
                "actual_mw": a_gen,
                "error_mw": err,
                "abs_error_mw": abs_err,
                "pct_error": pct_err,
                "publish_time": f_info["pub"] if f_info else None
            })
    else:
        # Settlement period resolution (48 points)
        for sp in range(1, 49):
            h = (sp - 1) // 2
            m = 30 if (sp % 2 == 0) else 0
            start_iso = f"{delivery_date}T{h:02d}:{m:02d}:00Z"
            
            # Forecast is published hourly at h:00.
            hour_start_iso = f"{delivery_date}T{h:02d}:00:00Z"
            next_hour_iso = f"{delivery_date}T{(h+1):02d}:00:00Z" if h < 23 else (deliv_end_iso)
            
            # Use interpolated or hourly forecast
            f_curr = forecasts_by_start.get(hour_start_iso)
            f_next = forecasts_by_start.get(next_hour_iso)
            
            if f_curr:
                if m == 0 or not f_next:
                    f_gen = f_curr["gen"]
                else:
                    # Linear interpolation for the :30 half-hour gives smoother curve
                    f_gen = round((f_curr["gen"] + f_next["gen"]) / 2.0, 1)
                pub_time = f_curr["pub"]
                if latest_pub_observed is None or pub_time > latest_pub_observed:
                    latest_pub_observed = pub_time
            else:
                f_gen = None
                pub_time = None
                
            a_gen = actuals_by_sp.get(sp)
            err = round(f_gen - a_gen, 1) if (f_gen is not None and a_gen is not None) else None
            abs_err = abs(err) if err is not None else None
            pct_err = round((abs_err / a_gen) * 100, 1) if (abs_err is not None and a_gen and a_gen > 0) else None
            
            if err is not None:
                errors.append(err)
                abs_errors.append(abs_err)
                
            points.append({
                "time_label": f"{h:02d}:{m:02d}",
                "start_time": start_iso,
                "settlement_period": sp,
                "forecast_mw": f_gen,
                "actual_mw": a_gen,
                "error_mw": err,
                "abs_error_mw": abs_err,
                "pct_error": pct_err,
                "publish_time": pub_time
            })

    mae = round(float(np.mean(abs_errors)), 1) if abs_errors else 0.0
    rmse = round(float(np.sqrt(np.mean(np.array(errors)**2))), 1) if errors else 0.0
    bias = round(float(np.mean(errors)), 1) if errors else 0.0
    actual_sum = sum(p["actual_mw"] for p in points if p["actual_mw"] is not None)
    wmape = round((sum(abs_errors) / actual_sum) * 100, 2) if (abs_errors and actual_sum > 0) else 0.0
    
    return {
        "delivery_date": delivery_date,
        "decision_date": decision_date_str,
        "cutoff_time": gate_closure_time,
        "cutoff_iso": cutoff_iso,
        "latest_forecast_publish_time": latest_pub_observed,
        "resolution": resolution,
        "summary": {
            "mae_mw": mae,
            "rmse_mw": rmse,
            "mean_bias_mw": bias,
            "wmape_pct": wmape,
            "total_actual_mwh": round(actual_sum * 0.5, 1) if resolution == "settlement_period" else round(actual_sum, 1),
            "max_error_mw": max(errors) if errors else 0.0,
            "min_error_mw": min(errors) if errors else 0.0,
            "over_forecast_periods": sum(1 for e in errors if e > 0),
            "under_forecast_periods": sum(1 for e in errors if e < 0),
            "total_points": len(points)
        },
        "points": points
    }

def get_forecast_evolution(delivery_date: str) -> Dict[str, Any]:
    """
    Retrieves multiple forecast vintages across time for the target delivery date:
    - D-2 (48h ahead)
    - D-1 Morning (06:00 GMT)
    - D-1 Day-Ahead Gate Closure (11:00 GMT)
    - D-1 Evening (18:00 GMT)
    - Intraday (latest forecast published before delivery day)
    - Actuals
    This visualizes forecast convergence and volatility leading into the delivery day.
    """
    deliv_dt = datetime.strptime(delivery_date, "%Y-%m-%d")
    d_minus_2 = (deliv_dt - timedelta(days=2)).strftime("%Y-%m-%d")
    d_minus_1 = (deliv_dt - timedelta(days=1)).strftime("%Y-%m-%d")
    
    vintages = [
        {"key": "d_minus_2", "name": "D-2 Horizon (~48h)", "cutoff": f"{d_minus_2}T12:00:00Z"},
        {"key": "d_minus_1_morning", "name": "D-1 Morning (06:00)", "cutoff": f"{d_minus_1}T06:00:00Z"},
        {"key": "d_minus_1_gate_closure", "name": "D-1 Gate Closure (11:00)", "cutoff": f"{d_minus_1}T11:00:00Z"},
        {"key": "d_minus_1_evening", "name": "D-1 Evening (18:00)", "cutoff": f"{d_minus_1}T18:00:00Z"},
        {"key": "intraday_final", "name": "Final Pre-Delivery (23:30)", "cutoff": f"{d_minus_1}T23:59:59Z"}
    ]
    
    deliv_start_iso = f"{delivery_date}T00:00:00Z"
    deliv_end_iso = (deliv_dt + timedelta(days=1)).strftime("%Y-%m-%d") + "T00:00:00Z"
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Actuals hourly
        cursor.execute("""
            SELECT start_time, settlement_period, generation
            FROM actuals
            WHERE settlement_date = ?
            ORDER BY settlement_period ASC
        """, (delivery_date,))
        actual_rows = cursor.fetchall()
        actuals_by_sp = {row["settlement_period"]: row["generation"] for row in actual_rows}
        
        vintage_data = {}
        for v in vintages:
            cursor.execute("""
                SELECT f.start_time, f.generation
                FROM forecasts f
                INNER JOIN (
                    SELECT start_time, MAX(publish_time) as max_pub
                    FROM forecasts
                    WHERE publish_time <= ? AND start_time >= ? AND start_time < ?
                    GROUP BY start_time
                ) latest ON f.start_time = latest.start_time AND f.publish_time = latest.max_pub
                ORDER BY f.start_time ASC
            """, (v["cutoff"], deliv_start_iso, deliv_end_iso))
            rows = cursor.fetchall()
            vintage_data[v["key"]] = {row["start_time"]: row["generation"] for row in rows}

    points = []
    for h in range(24):
        hour_iso = f"{delivery_date}T{h:02d}:00:00Z"
        sp1, sp2 = h * 2 + 1, h * 2 + 2
        a1, a2 = actuals_by_sp.get(sp1), actuals_by_sp.get(sp2)
        act_mw = round((a1 + a2) / 2.0, 1) if (a1 is not None and a2 is not None) else None
        
        item = {
            "hour": h,
            "time_label": f"{h:02d}:00",
            "actual_mw": act_mw
        }
        for v in vintages:
            item[v["key"]] = vintage_data[v["key"]].get(hour_iso)
        points.append(item)
        
    return {
        "delivery_date": delivery_date,
        "vintages": vintages,
        "points": points
    }

def evaluate_monthly_accuracy(
    start_date: str = "2026-01-01",
    end_date: str = "2026-01-31",
    gate_closure_time: str = DEFAULT_GATE_CLOSURE
) -> Dict[str, Any]:
    """
    Evaluates forecast accuracy across all purchase decisions made in January 2026.
    Computes rigorous market statistics:
    - MAE, RMSE, wMAPE, Mean Bias (MFE)
    - Error distributions, histograms, and empirical percentiles (P5 to P95)
    - Safety buffer requirement for risk-adjusted thermal procurement
    - Daily performance timeline
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT settlement_date FROM actuals WHERE settlement_date BETWEEN ? AND ? ORDER BY settlement_date", (start_date, end_date))
        dates = [row[0] for row in cursor.fetchall()]

    all_errors = []
    all_abs_errors = []
    all_actuals = []
    all_forecasts = []
    daily_summaries = []
    
    for d in dates:
        day_res = get_day_ahead_data(d, gate_closure_time=gate_closure_time, resolution="hourly")
        s = day_res["summary"]
        daily_summaries.append({
            "delivery_date": d,
            "decision_date": day_res["decision_date"],
            "mae_mw": s["mae_mw"],
            "rmse_mw": s["rmse_mw"],
            "bias_mw": s["mean_bias_mw"],
            "wmape_pct": s["wmape_pct"],
            "over_periods": s["over_forecast_periods"],
            "under_periods": s["under_forecast_periods"]
        })
        for p in day_res["points"]:
            if p["error_mw"] is not None:
                all_errors.append(p["error_mw"])
                all_abs_errors.append(p["abs_error_mw"])
                all_actuals.append(p["actual_mw"])
                all_forecasts.append(p["forecast_mw"])

    err_arr = np.array(all_errors)
    abs_err_arr = np.array(all_abs_errors)
    act_arr = np.array(all_actuals)
    
    total_n = len(err_arr)
    overall_mae = round(float(np.mean(abs_err_arr)), 1) if total_n > 0 else 0.0
    overall_rmse = round(float(np.sqrt(np.mean(err_arr**2))), 1) if total_n > 0 else 0.0
    overall_bias = round(float(np.mean(err_arr)), 1) if total_n > 0 else 0.0
    overall_std = round(float(np.std(err_arr)), 1) if total_n > 0 else 0.0
    total_actual = float(np.sum(act_arr)) if total_n > 0 else 0.0
    wmape = round((float(np.sum(abs_err_arr)) / total_actual) * 100, 2) if total_actual > 0 else 0.0
    
    # Over vs under forecasting
    over_count = int(np.sum(err_arr > 0))
    under_count = int(np.sum(err_arr < 0))
    exact_count = int(np.sum(err_arr == 0))
    
    # Percentiles
    p5 = round(float(np.percentile(err_arr, 5)), 1) if total_n > 0 else 0.0
    p10 = round(float(np.percentile(err_arr, 10)), 1) if total_n > 0 else 0.0
    p25 = round(float(np.percentile(err_arr, 25)), 1) if total_n > 0 else 0.0
    p50 = round(float(np.percentile(err_arr, 50)), 1) if total_n > 0 else 0.0
    p75 = round(float(np.percentile(err_arr, 75)), 1) if total_n > 0 else 0.0
    p90 = round(float(np.percentile(err_arr, 90)), 1) if total_n > 0 else 0.0
    p95 = round(float(np.percentile(err_arr, 95)), 1) if total_n > 0 else 0.0
    
    # Safety buffer recommended: 90% and 95% shortfall protection
    # Shortfall occurs when Forecast > Actual (err > 0), so wind generation is deficient.
    shortfalls = err_arr[err_arr > 0]
    p90_shortfall_buffer = round(float(np.percentile(shortfalls, 90)), 1) if len(shortfalls) > 0 else 0.0
    p95_shortfall_buffer = round(float(np.percentile(shortfalls, 95)), 1) if len(shortfalls) > 0 else 0.0
    
    # Histogram of errors for chart
    hist_counts, bin_edges = np.histogram(err_arr, bins=16)
    histogram = []
    for i in range(len(hist_counts)):
        histogram.append({
            "bin_start": round(float(bin_edges[i]), 0),
            "bin_end": round(float(bin_edges[i+1]), 0),
            "bin_label": f"{int(bin_edges[i])} to {int(bin_edges[i+1])} MW",
            "count": int(hist_counts[i])
        })
        
    return {
        "period": f"{start_date} to {end_date}",
        "gate_closure_time": gate_closure_time,
        "total_hours_analyzed": total_n,
        "total_days": len(dates),
        "kpis": {
            "mae_mw": overall_mae,
            "rmse_mw": overall_rmse,
            "mean_bias_mw": overall_bias,
            "std_dev_mw": overall_std,
            "wmape_pct": wmape,
            "over_forecast_pct": round((over_count / total_n) * 100, 1) if total_n > 0 else 0.0,
            "under_forecast_pct": round((under_count / total_n) * 100, 1) if total_n > 0 else 0.0,
            "recommended_buffer_p90_mw": p90_shortfall_buffer,
            "recommended_buffer_p95_mw": p95_shortfall_buffer
        },
        "percentiles": {
            "p5": p5, "p10": p10, "p25": p25, "p50": p50,
            "p75": p75, "p90": p90, "p95": p95
        },
        "histogram": histogram,
        "daily_timeline": daily_summaries
    }

def get_diurnal_settlement_period_profile(
    start_date: str = "2026-01-01",
    end_date: str = "2026-01-31",
    gate_closure_time: str = DEFAULT_GATE_CLOSURE
) -> List[Dict[str, Any]]:
    """
    Computes average actuals, forecasts, MAE, and bias for each of the 48 half-hour Settlement Periods.
    Identifies diurnal patterns, such as peak demand hour errors and morning ramp errors.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT settlement_date FROM actuals WHERE settlement_date BETWEEN ? AND ? ORDER BY settlement_date", (start_date, end_date))
        dates = [row[0] for row in cursor.fetchall()]

    sp_data = {sp: {"errors": [], "abs_errors": [], "actuals": [], "forecasts": []} for sp in range(1, 49)}
    
    for d in dates:
        day_res = get_day_ahead_data(d, gate_closure_time=gate_closure_time, resolution="settlement_period")
        for p in day_res["points"]:
            sp = p["settlement_period"]
            if p["error_mw"] is not None:
                sp_data[sp]["errors"].append(p["error_mw"])
                sp_data[sp]["abs_errors"].append(p["abs_error_mw"])
                sp_data[sp]["actuals"].append(p["actual_mw"])
                sp_data[sp]["forecasts"].append(p["forecast_mw"])
                
    profile = []
    for sp in range(1, 49):
        h = (sp - 1) // 2
        m = 30 if sp % 2 == 0 else 0
        d_entry = sp_data[sp]
        
        avg_act = round(float(np.mean(d_entry["actuals"])), 1) if d_entry["actuals"] else 0.0
        avg_for = round(float(np.mean(d_entry["forecasts"])), 1) if d_entry["forecasts"] else 0.0
        mae = round(float(np.mean(d_entry["abs_errors"])), 1) if d_entry["abs_errors"] else 0.0
        bias = round(float(np.mean(d_entry["errors"])), 1) if d_entry["errors"] else 0.0
        
        # Categorize period
        if 1 <= sp <= 12:
            period_type = "Night Base (00:00 - 06:00)"
        elif 13 <= sp <= 18:
            period_type = "Morning Ramp (06:00 - 09:00)"
        elif 19 <= sp <= 32:
            period_type = "Day Normal (09:00 - 16:00)"
        elif 33 <= sp <= 40:
            period_type = "Evening Peak (16:00 - 20:00)"
        else:
            period_type = "Late Evening (20:00 - 24:00)"
            
        profile.append({
            "settlement_period": sp,
            "time_label": f"{h:02d}:{m:02d}",
            "period_type": period_type,
            "avg_actual_mw": avg_act,
            "avg_forecast_mw": avg_for,
            "mae_mw": mae,
            "mean_bias_mw": bias
        })
    return profile

def simulate_thermal_procurement(
    delivery_date: str,
    baseline_demand_mw: float = 28000.0,
    risk_percentile: int = 90,
    gate_closure_time: str = DEFAULT_GATE_CLOSURE
) -> Dict[str, Any]:
    """
    Simulates the Day-Ahead procurement decision for a UK energy utility desk:
    - Consumer Demand baseline profile (with diurnal peak)
    - Available Wind Forecast as of gate closure
    - Safety buffer based on empirical forecast error risk
    - Recommended Day-Ahead Thermal Procurement Order (MW)
    - Financial exposure simulation under UK cash-out imbalance price spread
    """
    day_res = get_day_ahead_data(delivery_date, gate_closure_time=gate_closure_time, resolution="hourly")
    monthly_acc = evaluate_monthly_accuracy()
    
    # Select buffer from monthly distribution
    buffer_val = monthly_acc["kpis"]["recommended_buffer_p95_mw"] if risk_percentile >= 95 else (
        monthly_acc["kpis"]["recommended_buffer_p90_mw"] if risk_percentile >= 90 else (
            monthly_acc["kpis"]["mae_mw"] if risk_percentile >= 75 else 0.0
        )
    )
    
    # Typical UK diurnal demand multiplier curve by hour (0 to 23)
    diurnal_multipliers = [
        0.75, 0.72, 0.70, 0.70, 0.72, 0.78, # 00:00 - 05:00
        0.88, 1.05, 1.15, 1.18, 1.16, 1.15, # 06:00 - 11:00
        1.14, 1.13, 1.12, 1.15, 1.22, 1.28, # 12:00 - 17:00 (Evening Peak)
        1.25, 1.18, 1.08, 0.98, 0.88, 0.80  # 18:00 - 23:00
    ]
    
    points = []
    total_unhedged_imbalance_cost = 0.0
    total_hedged_imbalance_cost = 0.0
    
    # Indicative UK imbalance spread: £85/MWh for short shortfall penalty, £35/MWh value
    short_penalty_price = 85.0
    dump_price = 30.0
    
    for p in day_res["points"]:
        h = p["hour"]
        demand_mw = round(baseline_demand_mw * diurnal_multipliers[h], 1)
        wind_f = p["forecast_mw"] or 0.0
        wind_act = p["actual_mw"] or 0.0
        
        # Unhedged thermal procurement = Demand - Wind Forecast
        unhedged_thermal = max(0.0, demand_mw - wind_f)
        
        # Risk-adjusted hedged thermal procurement = Demand - Wind Forecast + Safety Buffer
        hedged_thermal = max(0.0, demand_mw - wind_f + buffer_val)
        
        # Actual net shortfall / surplus
        actual_net_generation_unhedged = wind_act + unhedged_thermal
        unhedged_imbalance = demand_mw - actual_net_generation_unhedged # >0 means utility is short!
        
        actual_net_generation_hedged = wind_act + hedged_thermal
        hedged_imbalance = demand_mw - actual_net_generation_hedged
        
        # Cost penalty: if short, pay short penalty; if long, dump at discount
        cost_unhedged = (unhedged_imbalance * short_penalty_price) if unhedged_imbalance > 0 else (abs(unhedged_imbalance) * (short_penalty_price - dump_price))
        cost_hedged = (hedged_imbalance * short_penalty_price) if hedged_imbalance > 0 else (abs(hedged_imbalance) * (short_penalty_price - dump_price))
        
        total_unhedged_imbalance_cost += max(0.0, cost_unhedged)
        total_hedged_imbalance_cost += max(0.0, cost_hedged)
        
        points.append({
            "hour": h,
            "time_label": p["time_label"],
            "demand_mw": demand_mw,
            "wind_forecast_mw": wind_f,
            "wind_actual_mw": wind_act,
            "safety_buffer_mw": buffer_val,
            "unhedged_thermal_order_mw": round(unhedged_thermal, 1),
            "recommended_hedged_thermal_mw": round(hedged_thermal, 1),
            "net_thermal_procurement_mw": round(hedged_thermal, 1),
            "unhedged_imbalance_mw": round(unhedged_imbalance, 1),
            "hedged_imbalance_mw": round(hedged_imbalance, 1)
        })
        
    return {
        "delivery_date": delivery_date,
        "baseline_demand_mw": baseline_demand_mw,
        "risk_percentile": risk_percentile,
        "safety_buffer_mw": buffer_val,
        "financial_impact": {
            "estimated_unhedged_penalty_gbp": round(total_unhedged_imbalance_cost, 0),
            "estimated_hedged_penalty_gbp": round(total_hedged_imbalance_cost, 0),
            "net_risk_savings_gbp": round(max(0.0, total_unhedged_imbalance_cost - total_hedged_imbalance_cost), 0)
        },
        "points": points
    }

if __name__ == "__main__":
    print("Testing analytics...")
    da = get_day_ahead_data("2026-01-15")
    print("DA Summary:", da["summary"])
    acc = evaluate_monthly_accuracy()
    print("Monthly KPIs:", acc["kpis"])
