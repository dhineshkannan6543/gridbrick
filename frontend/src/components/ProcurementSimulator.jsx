import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, TrendingDown, DollarSign } from 'lucide-react';

export default function ProcurementSimulator({ deliveryDate, cutoffTime }) {
  const [demandBaseline, setDemandBaseline] = useState(28000);
  const [riskPercentile, setRiskPercentile] = useState(90);
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSimulation();
  }, [deliveryDate, cutoffTime, demandBaseline, riskPercentile]);

  const fetchSimulation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/procurement-simulation?delivery_date=${deliveryDate}&baseline_demand_mw=${demandBaseline}&risk_percentile=${riskPercentile}&cutoff_time=${cutoffTime}`);
      if (res.ok) {
        const data = await res.json();
        setSimulation(data);
      }
    } catch (err) {
      console.error('Failed to run procurement simulation:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!simulation) {
    return <div className="loading-box">Loading procurement simulator...</div>;
  }

  const { points, safety_buffer_mw, financial_impact } = simulation;

  // Chart calculation
  const width = 1000;
  const height = 340;
  const margin = { top: 30, right: 30, bottom: 50, left: 70 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  const maxVal = Math.max(...points.map(p => p.demand_mw), 35000) * 1.1;
  const getX = (i) => margin.left + (i / (points.length - 1)) * chartW;
  const getY = (v) => margin.top + chartH - ((v || 0) / maxVal) * chartH;

  const demandPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.demand_mw)}`).join(' ');
  const windPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.wind_forecast_mw)}`).join(' ');
  const thermalPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.recommended_hedged_thermal_mw)}`).join(' ');

  return (
    <div>
      {/* Interactive Controls Bar */}
      <div className="controls-bar" style={{ background: '#090e1a', marginBottom: 20 }}>
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
            <span style={{ color: '#94a3b8' }}>Consumer Demand Baseline:</span>
            <span className="font-mono" style={{ color: '#38bdf8' }}>{demandBaseline.toLocaleString()} MW</span>
          </div>
          <input
            type="range"
            min="15000"
            max="40000"
            step="500"
            value={demandBaseline}
            onChange={(e) => setDemandBaseline(Number(e.target.value))}
            className="slider-control"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="control-label">
            <ShieldCheck size={16} color="#10b981" /> Hedging Confidence:
          </span>
          <div className="toggle-group">
            {[50, 80, 90, 95].map(pct => (
              <button
                key={pct}
                className={`toggle-btn ${riskPercentile === pct ? 'active' : ''}`}
                onClick={() => setRiskPercentile(pct)}
              >
                P{pct} {pct === 90 ? '(Recommended)' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Financial Impact & Hedging Metrics */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card" style={{ '--accent-gradient': 'linear-gradient(90deg, #10b981, #06b6d4)' }}>
          <div className="kpi-header">
            <span className="kpi-title">Wind Uncertainty Buffer</span>
            <div className="kpi-icon-pill" style={{ '--pill-bg': 'rgba(16, 185, 129, 0.1)', '--pill-color': '#10b981' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="kpi-value font-mono">
            +{safety_buffer_mw.toLocaleString()} <span className="kpi-unit">MW</span>
          </div>
          <div className="kpi-subtext">
            <span>Procured above raw net demand at P{riskPercentile}</span>
          </div>
        </div>

        <div className="kpi-card" style={{ '--accent-gradient': 'linear-gradient(90deg, #f59e0b, #fb923c)' }}>
          <div className="kpi-header">
            <span className="kpi-title">Average Net Thermal Day-Ahead Order</span>
            <div className="kpi-icon-pill" style={{ '--pill-bg': 'rgba(245, 158, 11, 0.1)', '--pill-color': '#f59e0b' }}>
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="kpi-value font-mono">
            {Math.round(points.reduce((acc, p) => acc + p.recommended_hedged_thermal_mw, 0) / points.length).toLocaleString()} <span className="kpi-unit">MW/h</span>
          </div>
          <div className="kpi-subtext">
            <span>To be purchased in UK Day-Ahead wholesale market</span>
          </div>
        </div>

        <div className="kpi-card" style={{ '--accent-gradient': 'linear-gradient(90deg, #fb7185, #f43f5e)' }}>
          <div className="kpi-header">
            <span className="kpi-title">Imbalance Cash-out Exposure (Unhedged)</span>
            <div className="kpi-icon-pill" style={{ '--pill-bg': 'rgba(244, 63, 94, 0.1)', '--pill-color': '#fb7185' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="kpi-value font-mono" style={{ color: '#fb7185' }}>
            £{(financial_impact.estimated_unhedged_penalty_gbp / 1000).toFixed(1)}k
          </div>
          <div className="kpi-subtext">
            <span>Risk under raw forecast if wind deficit strikes</span>
          </div>
        </div>
      </div>

      {/* Simulator Visualizer Chart */}
      <div className="chart-container">
        <div style={{ display: 'flex', gap: 18, marginBottom: 12, padding: '0 8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 600 }}>
            <span style={{ width: 14, height: 3, background: '#e2e8f0', borderRadius: 2 }}></span> Consumer Demand Baseline
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>
            <span style={{ width: 14, height: 3, background: '#f59e0b', borderRadius: 2 }}></span> Net Day-Ahead Thermal Requirement (Procure)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#06b6d4', fontWeight: 600 }}>
            <span style={{ width: 14, height: 3, background: '#06b6d4', borderRadius: 2 }}></span> Wind Forecast Contribution
          </div>
        </div>

        <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
          {/* Demand Line */}
          <path d={demandPath} fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
          
          {/* Thermal Procurement Line */}
          <path d={thermalPath} fill="none" stroke="#f59e0b" strokeWidth="3" />

          {/* Wind Forecast Line */}
          <path d={windPath} fill="none" stroke="#06b6d4" strokeWidth="2" strokeDasharray="3 3" />

          {/* X Axis */}
          {points.map((p, i) => {
            if (i % 3 === 0 || i === 23) {
              return (
                <text
                  key={i}
                  x={getX(i)}
                  y={margin.top + chartH + 20}
                  textAnchor="middle"
                  className="chart-axis-label"
                >
                  {p.time_label}
                </text>
              );
            }
            return null;
          })}
        </svg>
      </div>
    </div>
  );
}
