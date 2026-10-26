import React from 'react';

export default function ErrorDistributionChart({ histogram, percentiles, kpis }) {
  if (!histogram || histogram.length === 0) {
    return <div className="loading-box">Loading error distribution...</div>;
  }

  const width = 1000;
  const height = 350;
  const margin = { top: 30, right: 30, bottom: 60, left: 60 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  const maxCount = Math.max(...histogram.map(b => b.count), 10) * 1.2;
  const barW = (chartW / histogram.length) * 0.85;

  const getX = (i) => margin.left + (i / histogram.length) * chartW + (chartW / histogram.length) / 2;
  const getY = (count) => margin.top + chartH - (count / maxCount) * chartH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map(r => Math.round(maxCount * r));

  return (
    <div className="chart-container">
      {/* Legend & Risk Zones */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '0 8px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#a855f7' }}>
            <span style={{ width: 12, height: 12, background: 'rgba(168, 85, 247, 0.7)', borderRadius: 2 }}></span>
            Under-forecast (Wind surplus)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#fb7185' }}>
            <span style={{ width: 12, height: 12, background: 'rgba(244, 63, 94, 0.7)', borderRadius: 2 }}></span>
            Over-forecast (Wind deficit / Thermal short risk)
          </div>
        </div>

        {kpis && (
          <div style={{ display: 'flex', gap: 12 }}>
            <span className="badge badge-danger">
              Over-forecast: {kpis.over_forecast_pct}% of hours
            </span>
            <span className="badge badge-amber">
              P90 Hedging Buffer: +{kpis.recommended_buffer_p90_mw?.toLocaleString()} MW
            </span>
          </div>
        )}
      </div>

      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
        {/* Y Axis Grid */}
        {yTicks.map((val, i) => (
          <g key={i}>
            <line
              x1={margin.left}
              y1={getY(val)}
              x2={width - margin.right}
              y2={getY(val)}
              className="chart-grid-line"
            />
            <text
              x={margin.left - 10}
              y={getY(val) + 4}
              textAnchor="end"
              className="chart-axis-label"
            >
              {val} hrs
            </text>
          </g>
        ))}

        {/* Histogram Bars */}
        {histogram.map((bin, i) => {
          const isOverForecast = (bin.bin_start + bin.bin_end) / 2 >= 0;
          const barHeight = chartH - (getY(bin.count) - margin.top);
          return (
            <g key={i}>
              <rect
                x={getX(i) - barW / 2}
                y={getY(bin.count)}
                width={barW}
                height={Math.max(barHeight, 2)}
                rx="3"
                fill={isOverForecast ? 'rgba(244, 63, 94, 0.65)' : 'rgba(168, 85, 247, 0.65)'}
                stroke={isOverForecast ? '#fb7185' : '#c084fc'}
                strokeWidth="1"
              />
              {bin.count > 0 && (
                <text
                  x={getX(i)}
                  y={getY(bin.count) - 6}
                  textAnchor="middle"
                  className="chart-axis-label"
                  style={{ fill: '#e2e8f0', fontSize: '9px', fontWeight: 600 }}
                >
                  {bin.count}
                </text>
              )}
            </g>
          );
        })}

        {/* X Axis Labels */}
        {histogram.map((bin, i) => {
          if (i % 2 === 0 || i === histogram.length - 1) {
            return (
              <g key={i}>
                <line
                  x1={getX(i)}
                  y1={margin.top + chartH}
                  x2={getX(i)}
                  y2={margin.top + chartH + 5}
                  stroke="#334155"
                />
                <text
                  x={getX(i)}
                  y={margin.top + chartH + 20}
                  textAnchor="middle"
                  className="chart-axis-label"
                >
                  {Math.round(bin.bin_start)} MW
                </text>
              </g>
            );
          }
          return null;
        })}
      </svg>

      {/* Percentiles Table Bar */}
      {percentiles && (
        <div style={{ display: 'flex', justifyContent: 'space-around', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 8, marginTop: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>P10 Error</div>
            <div className="font-mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{percentiles.p10} MW</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>P25 Error</div>
            <div className="font-mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{percentiles.p25} MW</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>P50 Median</div>
            <div className="font-mono" style={{ fontWeight: 700, color: '#fff' }}>{percentiles.p50} MW</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>P75 Error</div>
            <div className="font-mono" style={{ fontWeight: 700, color: '#fbbf24' }}>{percentiles.p75} MW</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>P90 Tail Risk</div>
            <div className="font-mono" style={{ fontWeight: 700, color: '#fb7185' }}>{percentiles.p90} MW</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>P95 Extreme Shortfall</div>
            <div className="font-mono" style={{ fontWeight: 700, color: '#f43f5e' }}>{percentiles.p95} MW</div>
          </div>
        </div>
      )}
    </div>
  );
}
