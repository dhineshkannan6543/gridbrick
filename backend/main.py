"""
FastAPI Server for GridWind DA - Day-Ahead Renewable Procurement Decision Support System.
Serves energy market analytics, forecast evaluation, and procurement simulations.
"""

import os
from typing import Optional
from fastapi import FastAPI, Query, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import init_db, get_db
from analytics import (
    get_available_dates,
    get_day_ahead_data,
    get_forecast_evolution,
    evaluate_monthly_accuracy,
    get_diurnal_settlement_period_profile,
    simulate_thermal_procurement,
    DEFAULT_GATE_CLOSURE
)
from elexon_client import ElexonClient

app = FastAPI(
    title="GridWind DA - UK Day-Ahead Renewable Procurement Intelligence",
    description="Customized decision support and forecast accuracy evaluation for UK energy utilities.",
    version="1.0.0"
)

# Enable CORS for local development and hosted clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure database is initialized on startup
@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/api/health")
def health_check():
    """Health check endpoint for Docker, Heroku, and Vercel."""
    return {"status": "healthy", "service": "GridWind DA API", "version": "1.0.0"}

@app.get("/api/system-status")
def system_status():
    """Returns database record counts and connectivity metadata."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM actuals")
        actuals_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM forecasts")
        forecasts_count = cursor.fetchone()[0]
        cursor.execute("SELECT key, value FROM meta")
        meta_dict = {row["key"]: row["value"] for row in cursor.fetchall()}
        
    return {
        "status": "online",
        "database": "SQLite (Pre-seeded & Operational)",
        "actuals_records": actuals_count,
        "forecast_records": forecasts_count,
        "data_month": "January 2026",
        "last_seeded_at": meta_dict.get("last_seeded_at", "Pre-packaged"),
        "elexon_api_source": "Elexon Insights Solution (data.elexon.co.uk)"
    }

@app.get("/api/dates")
def list_dates():
    """Returns available delivery and decision dates in January 2026."""
    return get_available_dates()

@app.get("/api/overview")
def get_overview(
    cutoff_time: str = Query(DEFAULT_GATE_CLOSURE, description="Gate closure cutoff time (HH:MM)")
):
    """Monthly executive overview and portfolio KPIs for January 2026."""
    acc = evaluate_monthly_accuracy(gate_closure_time=cutoff_time)
    dates_info = get_available_dates()
    
    # Calculate total wind actual generation MWh across month
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT SUM(generation) * 0.5 FROM actuals WHERE settlement_date BETWEEN '2026-01-01' AND '2026-01-31'")
        total_mwh = cursor.fetchone()[0] or 0.0

    return {
        "client": "UK Energy Utility - Day-Ahead Power Procurement Desk",
        "decision_period": "January 2026",
        "gate_closure_time": cutoff_time,
        "total_wind_delivered_mwh": round(total_mwh, 1),
        "total_days_evaluated": acc["total_days"],
        "kpis": acc["kpis"],
        "percentiles": acc["percentiles"],
        "available_dates": dates_info["delivery_dates"]
    }

@app.get("/api/day-ahead")
def get_day_ahead(
    delivery_date: str = Query(..., description="Target delivery date (YYYY-MM-DD)"),
    cutoff_time: str = Query(DEFAULT_GATE_CLOSURE, description="Auction gate closure time (HH:MM)"),
    resolution: str = Query("settlement_period", description="'settlement_period' (48 half-hours) or 'hourly' (24 hours)")
):
    """
    Returns latest forecast available at day-ahead gate closure aligned with actual generation.
    Supports Settlement Period (30-min) and Hourly resolutions.
    """
    try:
        return get_day_ahead_data(
            delivery_date=delivery_date,
            gate_closure_time=cutoff_time,
            resolution=resolution
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/forecast-evolution")
def get_forecast_vintages(
    delivery_date: str = Query(..., description="Target delivery date (YYYY-MM-DD)")
):
    """
    Returns forecast evolution across multiple vintages (D-2, D-1 Morning, Gate Closure, D-1 Evening, Intraday, Actuals).
    Shows forecast convergence and stability leading into the delivery day.
    """
    try:
        return get_forecast_evolution(delivery_date=delivery_date)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/accuracy-metrics")
def get_accuracy_metrics(
    start_date: str = Query("2026-01-01", description="Start settlement date"),
    end_date: str = Query("2026-01-31", description="End settlement date"),
    cutoff_time: str = Query(DEFAULT_GATE_CLOSURE, description="Auction gate closure time (HH:MM)")
):
    """
    Returns comprehensive quantitative error evaluation:
    MAE, RMSE, wMAPE, Mean Bias, distributions, quantiles, and daily trends.
    """
    try:
        return evaluate_monthly_accuracy(
            start_date=start_date,
            end_date=end_date,
            gate_closure_time=cutoff_time
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/settlement-periods")
def get_settlement_periods_profile(
    start_date: str = Query("2026-01-01"),
    end_date: str = Query("2026-01-31"),
    cutoff_time: str = Query(DEFAULT_GATE_CLOSURE)
):
    """
    Returns diurnal analysis across the 48 half-hourly Settlement Periods.
    Identifies peak hour risks and morning ramp error patterns.
    """
    try:
        return get_diurnal_settlement_period_profile(
            start_date=start_date,
            end_date=end_date,
            gate_closure_time=cutoff_time
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/procurement-simulation")
def run_procurement_simulation(
    delivery_date: str = Query(..., description="Target delivery date (YYYY-MM-DD)"),
    baseline_demand_mw: float = Query(28000.0, description="Average utility consumer demand in MW"),
    risk_percentile: int = Query(90, description="Risk hedging confidence level (50, 75, 90, 95)"),
    cutoff_time: str = Query(DEFAULT_GATE_CLOSURE, description="Auction gate closure time (HH:MM)")
):
    """
    Simulates utility day-ahead thermal purchasing decision considering consumer demand,
    wind forecast, and risk buffer. Computes imbalance cost exposure.
    """
    try:
        return simulate_thermal_procurement(
            delivery_date=delivery_date,
            baseline_demand_mw=baseline_demand_mw,
            risk_percentile=risk_percentile,
            gate_closure_time=cutoff_time
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/sync")
def sync_data(background_tasks: BackgroundTasks):
    """Triggers background data resynchronization from live Elexon BMRS API."""
    def run_sync():
        client = ElexonClient()
        # Refresh current data
        actuals = client.fetch_actuals_fuelhh("2026-01-01", "2026-01-31")
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.executemany("""
                INSERT OR REPLACE INTO actuals (start_time, settlement_date, settlement_period, publish_time, generation)
                VALUES (:start_time, :settlement_date, :settlement_period, :publish_time, :generation)
            """, actuals)
            conn.commit()
            
    background_tasks.add_task(run_sync)
    return {"message": "Data synchronization initiated in background.", "status": "processing"}

# Serve frontend static assets from frontend/dist or root public/
FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
PUBLIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public"))

STATIC_DIR = FRONTEND_DIST if os.path.exists(FRONTEND_DIST) else (PUBLIC_DIR if os.path.exists(PUBLIC_DIR) else None)

if STATIC_DIR and os.path.exists(STATIC_DIR):
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    @app.get("/{full_path:path}")
    def serve_react(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        index_path = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"status": "online", "service": "AeroCast UK API", "version": "1.0.0"}
else:
    @app.get("/")
    def root():
        return {
            "status": "online",
            "service": "AeroCast UK - Day-Ahead Renewable Procurement API",
            "documentation": "/docs"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
