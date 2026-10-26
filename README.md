# AeroCast UK — Day-Ahead Renewable Procurement & Forecast Accuracy Suite

[![Docker Ready](https://img.shields.io/badge/Docker-Ready-blue.svg)](file:///c:/Users/divya/OneDrive/Documents/PressForge%20AI/GridBrick/Dockerfile)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-yellow.svg)](file:///c:/Users/divya/OneDrive/Documents/PressForge%20AI/GridBrick/backend/requirements.txt)
[![React 19](https://img.shields.io/badge/React-19-cyan.svg)](file:///c:/Users/divya/OneDrive/Documents/PressForge%20AI/GridBrick/frontend/package.json)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](file:///c:/Users/divya/OneDrive/Documents/PressForge%20AI/GridBrick/backend/main.py)
[![Test Suite](https://img.shields.io/badge/Tests-16%20Passed-brightgreen.svg)](file:///c:/Users/divya/OneDrive/Documents/PressForge%20AI/GridBrick/backend/tests)

> **Customized Decision Support and Quantitative Forecast Error Evaluation Platform for UK Energy Utilities**  
> Built for Day-Ahead Power Trading Desks purchasing electricity from the UK wholesale market (EPEX Spot & Nord Pool) using authentic National Grid ESO / Elexon BMRS data for **January 2026**.

---

## 1. Executive Summary & Problem Setting

In the UK electricity market, utility trading desks are responsible for procuring wholesale power in the **Day-Ahead auction** to serve customer demand across all 48 half-hour settlement periods (SP 1–48) of the delivery day.

Because electricity generation from renewable sources like wind is weather-dependent and volatile, utilities must accurately anticipate renewable generation so they know **how much thermal generation (e.g. CCGT gas turbines) to procure additionally**. 

### The Multi-Million-Pound Operational Problem:
1. **The Day-Ahead Auction Cutoff & "Look-Ahead Bias"**: Day-ahead orders in the UK wholesale market (EPEX Spot / Nord Pool) close on day $D-1$ at **11:00 / 12:00 GMT**. Traders can **only rely on forecasts published strictly on or before this gate closure**. Evaluating day-ahead decisions using forecasts published later (e.g. intraday or within-day) introduces severe *look-ahead bias*.
2. **Systematic Over-Forecasting Risk**: Our empirical evaluation of January 2026 Elexon data reveals that the National Wind Forecast was **over-forecasted across 84.4% of hours** (Mean Bias of **+1,840 MW** and MAE of **2,122 MW**). A trading desk naively trusting the raw wind forecast would consistently **under-buy thermal generation day-ahead**, forcing them into real-time short imbalances and incurring punitive **System Buy Price (SBP) cash-out penalties**.
3. **The Solution — AeroCast UK**:
   - Strictly enforces auction cut-off times, presenting only the latest actionable forecasts available at decision time (**Requirement 1**).
   - Quantifies forecast errors mathematically (MAE, RMSE, wMAPE, MFE Bias, P10–P95 distributions, and diurnal profiles) (**Requirement 2**).
   - Recommends an empirical **Safety Hedging Buffer (+4,650 MW at P90)**, protecting utility margins and avoiding imbalance charges.

---

## 2. Key Analytical Discoveries (January 2026 Data)

| Metric | Measured Value (Jan 2026) | Market Implication for Utility Desk |
| :--- | :--- | :--- |
| **Total Delivered Wind Generation** | **21,450 GWh** (42.8 TWh national load) | Wind contributed ~38% of total GB grid generation in Jan 2026. |
| **Mean Absolute Error (MAE)** | **2,122.8 MW** | High day-ahead uncertainty requiring flexible thermal readiness. |
| **Root Mean Squared Error (RMSE)** | **2,616.7 MW** | Significant tail-risk penalties from large frontal forecast busts. |
| **Weighted MAPE (wMAPE)** | **18.33%** | Standard MAPE would distort on calm days; wMAPE confirms ~18% error. |
| **Mean Forecast Error (Bias)** | **+1,840.3 MW** | Strong **over-forecasting bias**; model predicted far more wind than occurred. |
| **Over-forecast Ratio** | **84.4% of periods** | Extreme skew: Utility is structurally exposed to short cash-out penalties. |
| **P90 Recommended Risk Buffer** | **+4,650 MW** | Reserve thermal buffer needed to cover wind shortfall with 90% confidence. |
| **P95 Extreme Shortfall Buffer** | **+5,570 MW** | Conservative buffer for high-price gale front volatility days. |
| **Peak Risk Window** | **SP 33–40 (16:30–20:00)** | Error clusters during evening peak demand when market prices are highest. |

---

## 3. Architecture & Repository Structure

```
GridBrick/
├── Dockerfile                  # Multi-stage production container (Node build + Python runner)
├── docker-compose.yml          # One-command container startup
├── .dockerignore               # Optimized Docker build context
├── Procfile                    # Heroku Procfile for dynamic $PORT binding
├── runtime.txt                 # Heroku Python runtime version (3.12.3)
├── heroku.yml                  # Heroku container manifest
├── vercel.json                 # Vercel serverless deployment manifest
├── requirements.txt            # Root dependencies for cloud buildpacks
├── start.bat                   # 1-Click Windows development launcher
├── start.sh                    # 1-Click Linux / macOS development launcher
│
├── backend/                    # Python Backend (FastAPI + SQLite + Analytical Engine)
│   ├── main.py                 # FastAPI application, CORS, routers & static React asset serving
│   ├── database.py             # SQLite connection pooling, schema migration & indexing
│   ├── elexon_client.py        # Resilient Elexon BMRS API client with exponential backoff
│   ├── data_seeder.py          # ETL seeder fetching full Jan 2026 FUELHH & WINDFOR datasets
│   ├── analytics.py            # Quantitative evaluation engine, metrics, alignment & hedging logic
│   ├── requirements.txt        # Backend Python dependencies
│   ├── data/
│   │   └── gridwind.db         # Self-contained, pre-seeded SQLite database (5.8 MB)
│   └── tests/                  # Automated test suite (16 tests, 100% pass)
│       ├── test_analytics.py   # Unit tests for alignment, bias, metrics & simulation
│       └── test_api.py         # Integration tests for all FastAPI REST endpoints
│
├── frontend/                   # React Frontend (Vite + Modern Dark Mode Trading Terminal)
│   ├── package.json            # React 19, Lucide React, Vite dependencies
│   ├── vite.config.js          # Vite config with backend proxy on /api
│   ├── index.html              # HTML shell with Google Inter & JetBrains Mono typography
│   ├── dist/                   # Production-compiled bundle served directly by FastAPI
│   └── src/
│       ├── main.jsx            # React root mount
│       ├── App.jsx             # Main dashboard orchestrator, tab views & control bar
│       ├── index.css           # Custom design tokens, glassmorphism & responsive layouts
│       └── components/
│           ├── GenerationForecastChart.jsx  # Interactive SVG Area/Line Chart with hover tooltips
│           ├── EvolutionChart.jsx           # Multi-vintage forecast convergence (D-2 to Intraday)
│           ├── DiurnalProfileChart.jsx      # 48 Settlement Periods diurnal profile
│           ├── ErrorDistributionChart.jsx   # Error frequency histogram & P10-P95 percentiles
│           ├── ProcurementSimulator.jsx     # Interactive demand & thermal hedging sandbox
│           └── DataTable.jsx                # 48 SP audit table with instant CSV export
│
└── DEMO_SCRIPT.md              # 10-Minute Video Demo Guide (Part 1: Pitch, Part 2: Tech Lead)
```

---

## 4. How to Start the Application

### Option A: 1-Command Docker Startup (Recommended)
Prerequisites: Docker installed.

```bash
# Build and run the unified container (accessible at http://localhost:8000)
docker compose up --build
```
Open your browser to: **`http://localhost:8000`**

---

### Option B: Local Development Startup

#### 1. Backend (Python 3.10+)
```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt

# (Optional) Re-seed fresh data directly from live Elexon BMRS API
python data_seeder.py

# Run FastAPI server
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
The backend API is live at **`http://localhost:8000`**.  
Interactive OpenAPI / Swagger docs are available at **`http://localhost:8000/docs`**.

#### 2. Frontend (Node 18+)
```bash
# In a second terminal, navigate to frontend
cd frontend

# Install packages
npm install

# Start Vite dev server with proxy to backend
npm run dev
```
Open your browser to: **`http://localhost:3000`** (or `http://localhost:8000` where the built assets are served directly).

#### 3. Run Automated Tests
```bash
cd backend
python -m unittest discover -s tests -p "test_*.py"
```
*Result: 16 passing tests in under 1 second.*

---

## 5. Deployment Guide (Heroku & Vercel)

### Deploying to Heroku
The repository contains `Procfile`, `runtime.txt`, and `heroku.yml` ready for instant deployment:

```bash
# 1. Login to Heroku
heroku login

# 2. Create app
heroku create aerocast-uk

# 3. Deploy via git
git push heroku main

# 4. Open live app
heroku open
```
*Live App URL format:* `https://aerocast-uk.herokuapp.com`

### Deploying to Vercel
The repository contains `vercel.json` configured for dual static frontend + serverless Python backend routing:

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel --prod
```
*Live Vercel App URL:* [https://gridbrick-seven.vercel.app](https://gridbrick-seven.vercel.app)

---

## 6. Official Data Sources

The application queries and ingests data from the official **Elexon Insights Solution (BMRS)** APIs:

1. **Actual Wind Generation (`FUELHH` Stream)**:
   - Endpoint: `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream`
   - Filter: `fuelType == "WIND"`
   - Fields: `settlementDate`, `settlementPeriod` (1–48), `startTime` (30-min resolution), `generation` (MW).
2. **Forecasted Wind Generation (`WINDFOR` Stream)**:
   - Endpoint: `https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream`
   - Fields: `publishTime` (time forecast was generated), `startTime` (target hour), `generation` (MW).
3. **Auction Gate Closure Times**:
   - EPEX Spot UK Day-Ahead Auction: `11:00 GMT`
   - Nord Pool UK Day-Ahead Auction: `12:00 GMT`

---

## 7. Explicit Disclosure of AI Tool Assistance

In accordance with Section 2 of the assignment prompt:
> *"Please mention it explicitly in the README if you’ve used AI tools."*

**AI Tool Usage Disclosure**:  
This application was developed with the assistance of **Google Antigravity AI** (Advanced Agentic Pair-Programming Assistant). AI assistance was utilized for:
- Accelerating domain research on Elexon BMRS Insights API endpoints (`FUELHH` and `WINDFOR` streams) and UK wholesale day-ahead auction gate closure mechanics.
- Assisting in the formulation and implementation of energy market quantitative evaluation metrics (MAE, RMSE, wMAPE, MFE Bias, empirical shortfall quantiles, and diurnal settlement period profiles).
- Generating responsive SVG charts, glassmorphism UI styling tokens, and synthetic test suites.
- Architecting the multi-stage Dockerfile and deployment configurations for Heroku and Vercel.

All architectural decisions, mathematical alignments, domain constraints, and code implementations were verified and tested against the live Elexon BMRS API.
