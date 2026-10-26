import React, { useState } from 'react';

export default function EvolutionChart({ evolutionData }) {
  const [hoverHour, setHoverHour] = useState(null);

  if (!evolutionData || !evolutionData.points) {
    return <div className="loading-box">Loading forecast evolution data...</div>;
  }

  const { points, vintages } = evolutionData;

  const width = 1000;
  const height = 400;
  const margin = { top: 30, right: 40, bottom: 50, left: 70 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  // Vintage color mappings
  const vintageColors = {
    'd_minus_2': '#64748b',            // Muted Slate (48h out)
    'd_minus_1_morning': '#38bdf8',    // Sky Blue (D-1 morning)
    'd_minus_1_gate_closure': '#f59e0b',// Amber (Gate Closure 11:00)
    'd_minus_1_evening': '#a855f7',    // Violet (D-1 evening)
    'intraday_final': '#06b6d4'        // Cyan (Final pre-delivery)
  };

  // Find max value across all vintages and actuals
  let maxVal = 1000;
  points.forEach(p => {
    if (p.actual_mw && p.actual_mw > maxVal) maxVal = p.actual_mw;
    vintages.forEach(v => {
      if (p[v.key] && p[v.key] > maxVal) maxVal = p[v.key];
    });
  });
  maxVal = Math.round(maxVal * 1.15);

  const getX = (hour) => margin.left + (hour / 23) * chartW;
  const getY = (val) => margin.top + chartH - ((val || 0) / maxVal) * chartH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map(ratio => Math.round(maxVal * ratio));

  return (
    <div className="chart-container" onMouseLeave={() => setHoverHour(null)}>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 14, padding: '0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
          <span style={{ width: 14, height: 4, background: '#10b981', borderRadius: 2 }}></span> Actual Delivered
        </div>
        {vintages.map(v => (
          <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: vintageColors[v.key] || '#94a3b8' }}>
            <span style={{ width: 14, height: 3, background: vintageColors[v.key] || '#94a3b8', borderRadius: 2 }}></span> {v.name}
          </div>
        ))}
      </div>

      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
        {/* Y Axis Grid */}
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
          if (i % 3 === 0 || i === 23) {
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

        {/* Vintage Paths */}
        {vintages.map(v => {
          const pathD = points
            .filter(p => p[v.key] !== null && p[v.key] !== undefined)
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.hour)} ${getY(p[v.key])}`)
            .join(' ');

          if (!pathD) return null;
          return (
            <path
              key={v.key}
              d={pathD}
              fill="none"
              stroke={vintageColors[v.key] || '#94a3b8'}
              strokeWidth={v.key === 'd_minus_1_gate_closure' ? '2.5' : '1.8'}
              strokeDasharray={v.key === 'd_minus_2' ? '4 4' : 'none'}
              opacity={v.key === 'd_minus_1_gate_closure' ? 1.0 : 0.8}
            />
          );
        })}

        {/* Actuals Path (Bold Emerald) */}
        <path
          d={points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.hour)} ${getY(p.actual_mw)}`).join(' ')}
          fill="none"
          stroke="#10b981"
          strokeWidth="3.5"
        />

        {/* Hover Highlight */}
        {hoverHour !== null && (
          <line
            x1={getX(hoverHour)}
            y1={margin.top}
            x2={getX(hoverHour)}
            y2={margin.top + chartH}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {/* Invisible Overlay for mouse events */}
        {points.map((p) => (
          <rect
            key={p.hour}
            x={getX(p.hour) - (chartW / 24) / 2}
            y={margin.top}
            width={chartW / 24}
            height={chartH}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoverHour(p.hour)}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hoverHour !== null && points[hoverHour] && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(getX(hoverHour) / width) * 100}%`,
            top: '40%'
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
            Hour {points[hoverHour].time_label} GMT
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', fontWeight: 600, marginBottom: 4 }}>
            <span>Actual Delivered:</span>
            <span className="font-mono">{points[hoverHour].actual_mw?.toLocaleString()} MW</span>
          </div>
          {vintages.map(v => (
            <div key={v.key} style={{ display: 'flex', justifyContent: 'space-between', color: vintageColors[v.key], fontSize: '0.76rem', marginBottom: 2 }}>
              <span>{v.name}:</span>
              <span className="font-mono">{points[hoverHour][v.key]?.toLocaleString() || 'N/A'} MW</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
