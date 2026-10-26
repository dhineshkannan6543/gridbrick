import React, { useState } from 'react';

export default function GenerationForecastChart({ points, showThermalGap = false, demandBaseline = 28000 }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!points || points.length === 0) {
    return <div className="loading-box">No forecast or actual data available for selected criteria.</div>;
  }

  // Chart dimensions
  const width = 1000;
  const height = 400;
  const margin = { top: 30, right: 40, bottom: 50, left: 70 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  // Max value calculation
  const maxActual = Math.max(...points.map(p => p.actual_mw || 0));
  const maxForecast = Math.max(...points.map(p => p.forecast_mw || 0));
  const maxVal = showThermalGap ? Math.max(demandBaseline * 1.15, maxActual, maxForecast) : Math.max(maxActual, maxForecast, 1000) * 1.15;

  const getX = (index) => margin.left + (index / (points.length - 1)) * chartW;
  const getY = (val) => margin.top + chartH - ((val || 0) / maxVal) * chartH;

  // Construct SVG paths
  const actualPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.actual_mw)}`).join(' ');
  const actualArea = `${actualPath} L ${getX(points.length - 1)} ${getY(0)} L ${getX(0)} ${getY(0)} Z`;

  const forecastPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.forecast_mw)}`).join(' ');
  const forecastArea = `${forecastPath} L ${getX(points.length - 1)} ${getY(0)} L ${getX(0)} ${getY(0)} Z`;

  // Grid ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map(ratio => Math.round(maxVal * ratio));

  return (
    <div className="chart-container" onMouseLeave={() => setHoverIndex(null)}>
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y Axis Grid Lines */}
        {yTicks.map((tickVal, i) => (
          <g key={i}>
            <line
              x1={margin.left}
              y1={getY(tickVal)}
              x2={width - margin.right}
              y2={getY(tickVal)}
              className="chart-grid-line"
            />
            <text
              x={margin.left - 12}
              y={getY(tickVal) + 4}
              textAnchor="end"
              className="chart-axis-label"
            >
              {tickVal.toLocaleString()} MW
            </text>
          </g>
        ))}

        {/* X Axis Labels */}
        {points.map((p, i) => {
          // Render every 4th or 6th tick depending on length
          const step = points.length > 24 ? 4 : 2;
          if (i % step === 0 || i === points.length - 1) {
            return (
              <g key={i}>
                <line
                  x1={getX(i)}
                  y1={margin.top + chartH}
                  x2={getX(i)}
                  y2={margin.top + chartH + 6}
                  stroke="#334155"
                />
                <text
                  x={getX(i)}
                  y={margin.top + chartH + 22}
                  textAnchor="middle"
                  className="chart-axis-label"
                >
                  {p.time_label}
                </text>
              </g>
            );
          }
          return null;
        })}

        {/* Areas & Lines */}
        <path d={forecastArea} fill="url(#forecastGrad)" />
        <path d={actualArea} fill="url(#actualGrad)" />

        {/* Forecast Line (Cyan Dashed) */}
        <path
          d={forecastPath}
          fill="none"
          stroke="#06b6d4"
          strokeWidth="2.5"
          strokeDasharray="4 4"
        />

        {/* Actuals Line (Emerald Solid) */}
        <path
          d={actualPath}
          fill="none"
          stroke="#10b981"
          strokeWidth="3"
        />

        {/* Hover Line & Marker */}
        {hoverIndex !== null && (
          <g>
            <line
              x1={getX(hoverIndex)}
              y1={margin.top}
              x2={getX(hoverIndex)}
              y2={margin.top + chartH}
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {points[hoverIndex].actual_mw !== null && (
              <circle
                cx={getX(hoverIndex)}
                cy={getY(points[hoverIndex].actual_mw)}
                r="6"
                fill="#10b981"
                stroke="#fff"
                strokeWidth="2"
              />
            )}
            {points[hoverIndex].forecast_mw !== null && (
              <circle
                cx={getX(hoverIndex)}
                cy={getY(points[hoverIndex].forecast_mw)}
                r="6"
                fill="#06b6d4"
                stroke="#fff"
                strokeWidth="2"
              />
            )}
          </g>
        )}

        {/* Invisible Overlay for mouse events */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={getX(i) - (chartW / points.length) / 2}
            y={margin.top}
            width={chartW / points.length}
            height={chartH}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoverIndex(i)}
          />
        ))}
      </svg>

      {/* Interactive Tooltip Card */}
      {hoverIndex !== null && points[hoverIndex] && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(getX(hoverIndex) / width) * 100}%`,
            top: `${(getY(Math.max(points[hoverIndex].actual_mw || 0, points[hoverIndex].forecast_mw || 0)) / height) * 100}%`
          }}
        >
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>{points[hoverIndex].settlement_period ? `Settlement Period ${points[hoverIndex].settlement_period}` : points[hoverIndex].sp_range}</span>
            <span className="font-mono" style={{ color: '#fff', fontWeight: 600 }}>{points[hoverIndex].time_label} GMT</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981' }}></span> Actual:
            </span>
            <span className="font-mono" style={{ fontWeight: 700, color: '#fff' }}>
              {points[hoverIndex].actual_mw?.toLocaleString()} MW
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
            <span style={{ color: '#06b6d4', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#06b6d4' }}></span> Day-Ahead Forecast:
            </span>
            <span className="font-mono" style={{ fontWeight: 700, color: '#fff' }}>
              {points[hoverIndex].forecast_mw?.toLocaleString()} MW
            </span>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Delta (F - A):</span>
            <span
              className="font-mono"
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: points[hoverIndex].error_mw > 0 ? '#fb7185' : '#34d399'
              }}
            >
              {points[hoverIndex].error_mw > 0 ? `+${points[hoverIndex].error_mw.toLocaleString()}` : points[hoverIndex].error_mw?.toLocaleString()} MW ({points[hoverIndex].pct_error}%)
            </span>
          </div>

          {points[hoverIndex].publish_time && (
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>
              Published: {points[hoverIndex].publish_time.replace('T', ' ').replace('Z', ' UTC')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
