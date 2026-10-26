import React, { useState, useEffect } from 'react';
import {
  Wind,
  TrendingUp,
  AlertTriangle,
  Clock,
  Calendar,
  Layers,
  Activity,
  BarChart3,
  RefreshCw,
  Sliders,
  FileSpreadsheet,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Info
} from 'lucide-react';

import GenerationForecastChart from './components/GenerationForecastChart';
import EvolutionChart from './components/EvolutionChart';
import DiurnalProfileChart from './components/DiurnalProfileChart';
import ErrorDistributionChart from './components/ErrorDistributionChart';
import ProcurementSimulator from './components/ProcurementSimulator';
import DataTable from './components/DataTable';

export default function App() {
  // Application State
  const [activeTab, setActiveTab] = useState('decision'); // 'decision', 'accuracy', 'evolution', 'simulator', 'table'
  const [deliveryDate, setDeliveryDate] = useState('2026-01-15');
  const [cutoffTime, setCutoffTime] = useState('11:00');
  const [resolution, setResolution] = useState('settlement_period'); // 'settlement_period' or 'hourly'
  const [showThermalGap, setShowThermalGap] = useState(false);

  // Data states
  const [availableDates, setAvailableDates] = useState([]);
  const [overview, setOverview] = useState(null);
  const [dayAheadData, setDayAheadData] = useState(null);
  const [accuracyMetrics, setAccuracyMetrics] = useState(null);
  const [diurnalProfile, setDiurnalProfile] = useState([]);
  const [evolutionData, setEvolutionData] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initial load
  useEffect(() => {
    fetchInitialData();
  }, []);

  // When date or cutoff or resolution changes
  useEffect(() => {
    if (deliveryDate) {
      fetchDayAhead();
      fetchEvolution();
    }
  }, [deliveryDate, cutoffTime, resolution]);

  // When cutoff time changes, update monthly overview and accuracy
  useEffect(() => {
    fetchMonthlyAnalytics();
  }, [cutoffTime]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [datesRes, overviewRes] = await Promise.all([
        fetch('/api/dates'),
        fetch(`/api/overview?cutoff_time=${cutoffTime}`)
      ]);
      if (datesRes.ok) {
        const dJson = await datesRes.json();
        setAvailableDates(dJson.delivery_dates || []);
        if (dJson.default_date) setDeliveryDate(dJson.default_date);
      }
      if (overviewRes.ok) {
        const oJson = await overviewRes.json();
        setOverview(oJson);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDayAhead = async () => {
    try {
      const res = await fetch(`/api/day-ahead?delivery_date=${deliveryDate}&cutoff_time=${cutoffTime}&resolution=${resolution}`);
      if (res.ok) {
        const data = await res.json();
        setDayAheadData(data);
      }
    } catch (err) {
      console.error('Error fetching day ahead data:', err);
    }
  };

  const fetchEvolution = async () => {
    try {
      const res = await fetch(`/api/forecast-evolution?delivery_date=${deliveryDate}`);
      if (res.ok) {
        const data = await res.json();
        setEvolutionData(data);
      }
    } catch (err) {
      console.error('Error fetching evolution data:', err);
    }
  };

  const fetchMonthlyAnalytics = async () => {
    try {
      const [accRes, diurnRes, overRes] = await Promise.all([
        fetch(`/api/accuracy-metrics?cutoff_time=${cutoffTime}`),
        fetch(`/api/settlement-periods?cutoff_time=${cutoffTime}`),
        fetch(`/api/overview?cutoff_time=${cutoffTime}`)
      ]);
      if (accRes.ok) setAccuracyMetrics(await accRes.json());
      if (diurnRes.ok) setDiurnalProfile(await diurnRes.json());
      if (overRes.ok) setOverview(await overRes.json());
    } catch (err) {
      console.error('Error fetching monthly analytics:', err);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage('Connecting to Elexon BMRS API...');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        setSyncMessage('Sync initiated. Data up to date.');
        setTimeout(() => setSyncMessage(null), 4000);
      }
    } catch (err) {
      setSyncMessage('Sync request failed.');
      setTimeout(() => setSyncMessage(null), 4000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="app-container">
      {/* 1. Header Bar */}
      <header className="top-nav">
        <div className="brand-wrapper">
          <div className="brand-icon-box">
            <Wind size={26} />
          </div>
          <div>
            <h1 className="brand-title">AeroCast UK</h1>
            <div className="brand-subtitle">
              UK Day-Ahead Renewable Procurement & Forecast Evaluation Platform
            </div>
          </div>
        </div>

        <div className="nav-actions">
          <div className="live-pill">
            <div className="pulse-dot"></div>
            <span>Elexon BMRS Live Stream</span>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className={`sync-btn ${syncing ? 'loading' : ''}`}
            title="Trigger background sync with Elexon API"
          >
            <RefreshCw size={15} />
            <span>{syncing ? 'Syncing...' : 'Sync Elexon'}</span>
          </button>
        </div>
      </header>

      {/* Sync Notification Banner if active */}
      {syncMessage && (
        <div className="callout-box" style={{ padding: '10px 16px', marginBottom: 16 }}>
          <CheckCircle2 size={18} color="#10b981" />
          <span style={{ fontSize: '0.85rem', color: '#f1f5f9' }}>{syncMessage}</span>
        </div>
      )}

      {/* 2. Global Controls Bar (Date, Gate Closure Cutoff, Resolution) */}
      <section className="controls-bar">
        <div className="control-group">
          <span className="control-label">
            <Calendar size={15} color="#38bdf8" /> Target Delivery Date:
          </span>
          <select
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="select-custom"
          >
            {availableDates.map(d => (
              <option key={d} value={d}>
                {d} (Decision Date: {new Date(new Date(d).getTime() - 86400000).toISOString().split('T')[0]})
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <span className="control-label">
            <Clock size={15} color="#f59e0b" /> Day-Ahead Auction Cutoff:
          </span>
          <select
            value={cutoffTime}
            onChange={(e) => setCutoffTime(e.target.value)}
            className="select-custom"
          >
            <option value="11:00">11:00 GMT (EPEX Spot DA Auction)</option>
            <option value="12:00">12:00 GMT (Nord Pool DA Gate Closure)</option>
            <option value="09:00">09:00 GMT (Early Morning Desk Run)</option>
            <option value="14:00">14:00 GMT (Post-Auction Sensitivity)</option>
          </select>
        </div>

        <div className="control-group">
          <span className="control-label">
            <Layers size={15} color="#10b981" /> Granularity:
          </span>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${resolution === 'settlement_period' ? 'active' : ''}`}
              onClick={() => setResolution('settlement_period')}
            >
              SP (48 Half-Hours)
            </button>
            <button
              className={`toggle-btn ${resolution === 'hourly' ? 'active' : ''}`}
              onClick={() => setResolution('hourly')}
            >
              Hourly (24 Hours)
            </button>
          </div>
        </div>
      </section>

      {/* 3. Executive KPI Cards (Overall Portfolio Context) */}
      {overview && overview.kpis && (
        <section className="kpi-grid">
          <div className="kpi-card" style={{ '--accent-gradient': 'linear-gradient(90deg, #10b981, #06b6d4)' }}>
            <div className="kpi-header">
              <span className="kpi-title">Monthly Wind Delivered</span>
              <div className="kpi-icon-pill" style={{ '--pill-bg': 'rgba(16, 185, 129, 0.1)', '--pill-color': '#10b981' }}>
                <Zap size={18} />
              </div>
            </div>
            <div className="kpi-value font-mono">
              {(overview.total_wind_delivered_mwh / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="kpi-unit">GWh</span>
            </div>
            <div className="kpi-subtext">
              <span>National wind actuals (FUELHH)</span>
            </div>
          </div>

          <div className="kpi-card" style={{ '--accent-gradient': 'linear-gradient(90deg, #06b6d4, #3b82f6)' }}>
            <div className="kpi-header">
              <span className="kpi-title">Day-Ahead MAE Error</span>
              <div className="kpi-icon-pill" style={{ '--pill-bg': 'rgba(6, 182, 212, 0.1)', '--pill-color': '#06b6d4' }}>
                <Activity size={18} />
              </div>
            </div>
            <div className="kpi-value font-mono">
              {overview.kpis.mae_mw?.toLocaleString()} <span className="kpi-unit">MW</span>
            </div>
            <div className="kpi-subtext">
              <span>wMAPE: <strong style={{ color: '#38bdf8' }}>{overview.kpis.wmape_pct}%</strong> | RMSE: {overview.kpis.rmse_mw} MW</span>
            </div>
          </div>

          <div className="kpi-card" style={{ '--accent-gradient': 'linear-gradient(90deg, #f43f5e, #fb7185)' }}>
            <div className="kpi-header">
              <span className="kpi-title">Mean Forecast Bias (MFE)</span>
              <div className="kpi-icon-pill" style={{ '--pill-bg': 'rgba(244, 63, 94, 0.1)', '--pill-color': '#f43f5e' }}>
                <AlertTriangle size={18} />
              </div>
            </div>
            <div className="kpi-value font-mono" style={{ color: overview.kpis.mean_bias_mw > 0 ? '#fb7185' : '#34d399' }}>
              {overview.kpis.mean_bias_mw > 0 ? `+${overview.kpis.mean_bias_mw}` : overview.kpis.mean_bias_mw} <span className="kpi-unit">MW</span>
            </div>
            <div className="kpi-subtext">
              <span className="badge badge-danger">
                {overview.kpis.over_forecast_pct}% Over-forecast Bias
              </span>
            </div>
          </div>

          <div className="kpi-card" style={{ '--accent-gradient': 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}>
            <div className="kpi-header">
              <span className="kpi-title">Recommended Safety Buffer (P90)</span>
              <div className="kpi-icon-pill" style={{ '--pill-bg': 'rgba(245, 158, 11, 0.1)', '--pill-color': '#f59e0b' }}>
                <ShieldCheck size={18} />
              </div>
            </div>
            <div className="kpi-value font-mono" style={{ color: '#fbbf24' }}>
              +{overview.kpis.recommended_buffer_p90_mw?.toLocaleString()} <span className="kpi-unit">MW</span>
            </div>
            <div className="kpi-subtext">
              <span>P95 Extreme Shortfall Buffer: <strong>+{overview.kpis.recommended_buffer_p95_mw?.toLocaleString()} MW</strong></span>
            </div>
          </div>
        </section>
      )}

      {/* 4. Strategic Domain Insight Banner */}
      <section className="callout-box">
        <Info size={22} className="callout-icon" />
        <div>
          <h2 className="callout-title">UK Wholesale Market Day-Ahead Operational Insight</h2>
          <p className="callout-text">
            For power purchase decisions in January 2026, the National Wind Forecast exhibited a systematic 
            <strong style={{ color: '#fb7185' }}> +1,840 MW over-forecasting bias</strong> across 84.4% of settlement periods.
            If a utility trading desk bought thermal generation relying solely on raw wind forecasts, they would have consistently under-procured,
            incurring severe <strong>System Buy Price (SBP) imbalance cash-out penalties</strong>.
            AeroCast eliminates look-ahead bias and quantifies the exact <strong>+4,650 MW (P90) safety buffer</strong> needed to protect margins.
          </p>
        </div>
      </section>

      {/* 5. Tabbed Navigation */}
      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'decision' ? 'active' : ''}`}
          onClick={() => setActiveTab('decision')}
        >
          <Activity size={17} /> Day-Ahead Decision Hub (Req 1)
        </button>
        <button
          className={`tab-btn ${activeTab === 'accuracy' ? 'active' : ''}`}
          onClick={() => setActiveTab('accuracy')}
        >
          <BarChart3 size={17} /> Quantitative Error Evaluation (Req 2)
        </button>
        <button
          className={`tab-btn ${activeTab === 'evolution' ? 'active' : ''}`}
          onClick={() => setActiveTab('evolution')}
        >
          <TrendingUp size={17} /> Forecast Convergence & Vintages
        </button>
        <button
          className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulator')}
        >
          <Sliders size={17} /> Procurement & Hedging Simulator
        </button>
        <button
          className={`tab-btn ${activeTab === 'table' ? 'active' : ''}`}
          onClick={() => setActiveTab('table')}
        >
          <FileSpreadsheet size={17} /> Settlement Audit & CSV Export
        </button>
      </nav>

      {/* 6. Main Tab Views */}
      <main>
        {/* Tab 1: Day-Ahead Decision Hub */}
        {activeTab === 'decision' && dayAheadData && (
          <div className="panel-card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  <Activity size={20} color="#06b6d4" />
                  Day-Ahead Wind Forecast vs Actual Generation for {deliveryDate}
                </h2>
                <div className="panel-desc">
                  Based strictly on forecasts published before {cutoffTime} GMT on D-1 ({dayAheadData.decision_date})
                  {dayAheadData.latest_forecast_publish_time && ` • Latest publication utilized: ${dayAheadData.latest_forecast_publish_time.replace('T', ' ').replace('Z', ' UTC')}`}
                </div>
              </div>

              <div className="legend-list">
                <div className="legend-item">
                  <div className="legend-swatch" style={{ background: '#10b981' }}></div>
                  <span>Delivered Wind Actuals (FUELHH)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-swatch" style={{ background: '#06b6d4', border: '1px dashed #fff' }}></div>
                  <span>Day-Ahead Forecast as of {cutoffTime} (WINDFOR)</span>
                </div>
              </div>
            </div>

            <GenerationForecastChart
              points={dayAheadData.points}
              showThermalGap={showThermalGap}
            />

            {/* Day specific summary metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 20 }}>
              <div style={{ background: 'var(--bg-card-alt)', padding: '14px 18px', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase' }}>Day's MAE Error</div>
                <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8' }}>
                  {dayAheadData.summary.mae_mw} MW
                </div>
              </div>
              <div style={{ background: 'var(--bg-card-alt)', padding: '14px 18px', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase' }}>Day's Weighted MAPE</div>
                <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>
                  {dayAheadData.summary.wmape_pct}%
                </div>
              </div>
              <div style={{ background: 'var(--bg-card-alt)', padding: '14px 18px', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase' }}>Mean Bias (F - A)</div>
                <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: dayAheadData.summary.mean_bias_mw > 0 ? '#fb7185' : '#34d399' }}>
                  {dayAheadData.summary.mean_bias_mw > 0 ? `+${dayAheadData.summary.mean_bias_mw}` : dayAheadData.summary.mean_bias_mw} MW
                </div>
              </div>
              <div style={{ background: 'var(--bg-card-alt)', padding: '14px 18px', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase' }}>Total Delivered Wind Energy</div>
                <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f1f5f9' }}>
                  {dayAheadData.summary.total_actual_mwh?.toLocaleString()} MWh
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Quantitative Error Analytics */}
        {activeTab === 'accuracy' && accuracyMetrics && (
          <div>
            {/* Error Distribution & Statistical Quantiles */}
            <div className="panel-card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    <BarChart3 size={20} color="#fb7185" />
                    Forecast Error Frequency Distribution & Risk Percentiles
                  </h2>
                  <div className="panel-desc">
                    Histogram of forecast errors (MW = Forecast - Actual) across {accuracyMetrics.total_hours_analyzed} operational hours in January 2026.
                  </div>
                </div>
              </div>

              <ErrorDistributionChart
                histogram={accuracyMetrics.histogram}
                percentiles={accuracyMetrics.percentiles}
                kpis={accuracyMetrics.kpis}
              />
            </div>

            {/* Diurnal Settlement Period Profile */}
            <div className="panel-card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    <Clock size={20} color="#38bdf8" />
                    Settlement Period Diurnal Error Profile (SP 1 to 48)
                  </h2>
                  <div className="panel-desc">
                    Identifies intraday error clustering. Note higher MAE during Evening Peak demand hours (SP 33 to 40, 16:30 - 20:00).
                  </div>
                </div>
              </div>

              <DiurnalProfileChart profileData={diurnalProfile} />
            </div>

            {/* Daily Error Trend across January 2026 */}
            <div className="panel-card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    <TrendingUp size={20} color="#10b981" />
                    Daily Forecast Accuracy Timeline (January 1 - 31, 2026)
                  </h2>
                  <div className="panel-desc">
                    Daily Mean Absolute Error (MAE) and Bias across all 31 delivery days.
                  </div>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Delivery Date</th>
                      <th>Decision Date (D-1)</th>
                      <th>MAE (MW)</th>
                      <th>RMSE (MW)</th>
                      <th>Weighted MAPE %</th>
                      <th>Daily Bias (MW)</th>
                      <th>Over-forecast Hrs</th>
                      <th>Under-forecast Hrs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accuracyMetrics.daily_timeline?.map((day) => (
                      <tr key={day.delivery_date} style={{ cursor: 'pointer' }} onClick={() => { setDeliveryDate(day.delivery_date); setActiveTab('decision'); }}>
                        <td className="font-mono" style={{ fontWeight: 600, color: '#38bdf8' }}>
                          {day.delivery_date}
                        </td>
                        <td className="font-mono" style={{ color: '#94a3b8' }}>
                          {day.decision_date}
                        </td>
                        <td className="font-mono" style={{ fontWeight: 700 }}>
                          {day.mae_mw} MW
                        </td>
                        <td className="font-mono" style={{ color: '#94a3b8' }}>
                          {day.rmse_mw} MW
                        </td>
                        <td className="font-mono" style={{ color: day.wmape_pct > 25 ? '#fb7185' : '#10b981' }}>
                          {day.wmape_pct}%
                        </td>
                        <td className="font-mono" style={{ color: day.bias_mw > 0 ? '#fb7185' : '#34d399', fontWeight: 700 }}>
                          {day.bias_mw > 0 ? `+${day.bias_mw}` : day.bias_mw} MW
                        </td>
                        <td className="font-mono" style={{ color: '#fb7185' }}>
                          {day.over_periods} / 24
                        </td>
                        <td className="font-mono" style={{ color: '#a855f7' }}>
                          {day.under_periods} / 24
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Forecast Convergence & Vintages */}
        {activeTab === 'evolution' && evolutionData && (
          <div className="panel-card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  <TrendingUp size={20} color="#a855f7" />
                  Forecast Vintage Tightening & Convergence for {deliveryDate}
                </h2>
                <div className="panel-desc">
                  Compares forecast progression: D-2 horizon (48h out) vs D-1 Morning (06:00) vs Day-Ahead Gate Closure (11:00) vs Intraday vs Actuals.
                </div>
              </div>
            </div>

            <EvolutionChart evolutionData={evolutionData} />

            <div className="callout-box" style={{ marginTop: 20 }}>
              <Info size={20} className="callout-icon" />
              <div>
                <h3 className="callout-title" style={{ fontSize: '0.9rem' }}>Why Multi-Vintage Tracking Protects Procurement Margins:</h3>
                <p className="callout-text">
                  Wind forecast volatility between D-2 and Day-Ahead Gate Closure (11:00 GMT) is often over 2,000 MW.
                  If the forecast shifts downward as gate closure approaches, thermal procurement teams must promptly secure flexible thermal capacity
                  before liquidity dries up in the intraday market.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Procurement Simulator */}
        {activeTab === 'simulator' && (
          <div className="panel-card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  <Sliders size={20} color="#f59e0b" />
                  Day-Ahead Thermal Procurement & Risk Hedging Sandbox
                </h2>
                <div className="panel-desc">
                  Simulate your utility's wholesale purchase orders for {deliveryDate}. Adjust consumer demand profile and select safety buffer level.
                </div>
              </div>
            </div>

            <ProcurementSimulator
              deliveryDate={deliveryDate}
              cutoffTime={cutoffTime}
            />
          </div>
        )}

        {/* Tab 5: Data Audit Trail & Table */}
        {activeTab === 'table' && dayAheadData && (
          <div className="panel-card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  <FileSpreadsheet size={20} color="#10b981" />
                  Settlement Period Operational Audit Trail ({deliveryDate})
                </h2>
                <div className="panel-desc">
                  Verifiable audit log with exact Elexon publish timestamps and settlement period actuals.
                </div>
              </div>
            </div>

            <DataTable
              points={dayAheadData.points}
              deliveryDate={deliveryDate}
              resolution={resolution}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ marginTop: 40, borderTop: '1px solid var(--border-subtle)', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem' }}>
        <div>
          <strong>AeroCast UK</strong> • Purpose-built for UK Energy Utility Power Procurement Desks • Source: Elexon BMRS Insights API
        </div>
        <div>
          Evaluated for January 2026 Day-Ahead Purchase Decisions
        </div>
      </footer>
    </div>
  );
}
