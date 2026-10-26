# 5-Minute Video Recording Cheatsheet (Natural & Conversational)

> **Goal**: A clean, natural ~5-minute screen recording.  
> **Structure**: 2.5 minutes Client Pitch + 2.5 minutes Tech Lead Walkthrough.  
> **URL on screen**: [https://gridbrick-seven.vercel.app](https://gridbrick-seven.vercel.app)

---

## 🎬 Quick Setup Before Hitting "Record"
1. Have **[https://gridbrick-seven.vercel.app](https://gridbrick-seven.vercel.app)** open in your browser.
2. Have your code editor open in another window with a terminal ready at the `backend` folder.
3. Start your screen recorder (Loom, OBS, or Zoom).

---

# 🎙️ PART 1: Pitching to the Utility Client (~2.5 Minutes)
*(Keep the browser open on the dashboard)*

### [0:00 – 0:35] The Problem & Introduction
> *"Hi everyone! Today, I’m excited to share the results of our pilot project for your Day-Ahead Power Procurement desk here in the UK.  
> 
> As traders, every morning before the 11:00 AM auction gate closure on EPEX Spot or Nord Pool, you have to decide how much power to buy for tomorrow. Specifically, you need to know how much thermal generation—like CCGT gas plants—you need to procure to cover customer demand beyond what renewable wind generates.  
> 
> If you overestimate wind, you under-procure thermal power, leaving you short in real-time and paying painful cash-out imbalance penalties. If you underestimate wind, you over-buy and dump power at a loss. To solve this, we built **AeroCast UK**."*

---

### [0:35 – 1:15] The Big Discovery: The 84% Over-Forecasting Trap
*(Action: Point your mouse to the top KPI cards: **Mean Bias +1,840 MW** and **Over-forecast: 84.4%**)*

> *"When we analyzed the official Elexon and National Grid data for the entire month of January 2026, we found something staggering:  
> 
> **The National Day-Ahead Wind Forecast was over-forecasting wind 84.4% of the time!**  
> 
> The average bias was **+1,840 MW**. That means for more than 4 out of every 5 hours in January, the raw wind forecast told your desk that wind was going to be much stronger than it actually was.  
> 
> Any trading desk that naively followed the raw wind forecast would have consistently under-bought thermal power by nearly 2,000 MW every single day, walking right into massive peak-hour imbalance penalties."*

---

### [1:15 – 1:55] How the App Solves It: Decision Hub (No Look-Ahead Bias)
*(Action: Click on **Day-Ahead Decision Hub**. Change the date or cutoff, and hover over the chart lines)*

> *"Here’s how AeroCast protects your desk on a daily basis.  
> 
> In our **Day-Ahead Decision Hub**, you choose your delivery date—for example, January 15th. Notice this cutoff selector set to **11:00 GMT**.  
> 
> Most generic analytics platforms cheat with 'look-ahead bias'—they show you forecasts updated late in the evening. But your auction order had to be submitted at 11:00 AM! AeroCast strictly pulls **only the latest forecast published on or before your auction deadline**.  
> 
> The emerald line is actual delivered wind from Elexon FUELHH, and the cyan dashed line is the exact forecast available at your trade decision. You can toggle between 48 half-hour settlement periods and hourly averages, and hovering shows the exact delta in megawatts."*

---

### [1:55 – 2:35] The Solution: Quantified Error & Hedging Buffer
*(Action: Click on **Procurement & Hedging Simulator**. Move the Demand slider, click **P90 Hedging**)*

> *"Now, instead of guessing how much buffer to add, our **Quantitative Engine** calculates the exact risk distribution.  
> 
> Across January, our model calculated that to protect against wind shortfalls with **90% statistical confidence**, your desk needed a **Safety Buffer of +4,650 MW**.  
> 
> Over in our **Procurement Sandbox**, you simply enter your customer demand—say, 28,000 MW—and select **P90 Hedging**. The system instantly tells you the exact recommended thermal order to submit for every hour of tomorrow.  
> 
> As you can see on the financial card, applying this data-driven hedge eliminates an estimated **£4.6 Million in cash-out penalties** across the month. It turns weather uncertainty into a calculated, profitable strategy."*

---

# 💻 PART 2: Technical Walkthrough for Tech Lead (~2.5 Minutes)
*(Action: Switch your screen to your Code Editor / VS Code)*

### [2:35 – 3:20] Architecture & Tech Stack
*(Action: Show the folder structure: `backend/`, `frontend/`, `Dockerfile`)*

> *"Now, switching hats to the technical review for our tech lead.  
> 
> The project is structured as a modern decoupled full-stack application:  
> - **Backend**: Python 3.12 with **FastAPI** for high-performance async REST endpoints, backed by **SQLite** pre-seeded with authentic Elexon BMRS January 2026 data.  
> - **Frontend**: **React 19** with Vite. We built lightweight custom SVG charts for high responsiveness without bulky third-party dependencies.  
> - **Containerization & Cloud**: Fully Dockerized with a multi-stage Dockerfile and deployed live on **Vercel** with serverless Python functions."*

---

### [3:20 – 4:05] Data Ingestion & Gate Closure Alignment
*(Action: Open `backend/analytics.py` and highlight lines 45–65)*

> *"Let’s look at how we enforce gate closure in the code.  
> In `backend/elexon_client.py`, we pull `FUELHH` for actual generation and `WINDFOR` for forecasts with exponential backoff for rate limits.  
> 
> Here in `backend/analytics.py`, we solve the time-alignment problem:  
> When a trader evaluates delivery day D, the decision cutoff is D minus 1 at 11:00 AM.  
> We execute an inner join query that selects `MAX(publish_time)` where `publish_time <= cutoff`. This guarantees zero look-ahead bias.  
> 
> We also handle the resolution difference: `FUELHH` is half-hourly (48 settlement periods), while `WINDFOR` is hourly (24 points). We support both by linearly interpolating for half-hours and averaging settlement periods for hourly matching."*

---

### [4:05 – 4:40] Mathematical Metrics & Running Automated Tests
*(Action: Open your terminal in VS Code and run `python -m unittest discover -s tests -p "test_*.py"`)*

> *"For error quantification, we implemented standard energy trading metrics:  
> - **MAE** and **RMSE** for spread and outlier penalties.  
> - **Weighted MAPE (wMAPE)**, which prevents division-by-zero distortion during calm wind periods.  
> - **Mean Forecast Error (Bias)** and empirical percentiles from P10 to P95.  
> 
> To ensure reliability, we built an automated test suite covering both unit calculations and FastAPI REST endpoints. Let’s run them now:  
> *(Run command)*  
> As you can see, all **16 tests pass in less than one second**."*

---

### [4:40 – 5:00] Deployment & Wrap-Up
*(Action: Switch back to the live browser tab at `https://gridbrick-seven.vercel.app`)*

> *"Finally, for deployment:  
> - The entire application is containerized with `Dockerfile` and `docker-compose.yml` for local 1-command startup.  
> - It is currently live and deployed in production on **Vercel** at `gridbrick-seven.vercel.app`.  
> - Full code, documentation, and explicit AI assistance disclosure are committed to our public GitHub repo at `github.com/dhineshkannan6543/gridbrick`.  
> 
> Thank you, and I look forward to your review!"*

---

### ⏱️ Total Time: ~4:45 – 5:15 (Perfect length!)
- **Upload**: YouTube Studio $\to$ Set to **Unlisted** $\to$ Copy Link.
- **Submit**: Paste your YouTube link alongside `https://gridbrick-seven.vercel.app`.
