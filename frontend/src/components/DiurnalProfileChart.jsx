import React, { useState } from 'react';

export default function DiurnalProfileChart({ profileData }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!profileData || profileData.length === 0) {
    return <div className="loading-box">Loading diurnal settlement period profile...</div>;
  }

  const width = 1000;
  const height = 360;
  const margin = { top: 30, right: 30, bottom: 50, left: 70 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  // Max MAE for scaling
  const maxMae = Math.max(...profileData.map(d => d.mae_mw), 1000) * 1.2;
  const barW = (chartW / profileData.length) * 0.75;

  const getX = (i) => margin.left + (i / profileData.length) * chartW + (chartW / profileData.length) / 2;
  const getY = (val) => margin.top + chartH - ((val || 0) / maxMae) * chartH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map(r => Math.round(maxMae * r));

  return (
    <div className="chart-container" onMouseLeave={() => setHoverIndex(null)}>
      {/* Legend & Period Highlights */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 8px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#38bdf8' }}>
            <span style={{ width: 12, height: 12, background: 'rgba(56, 189, 248, 0.8)', borderRadius: 2 }}></span>
            Mean Absolute Error (MAE)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#fb7185' }}>
            <span style={{ width: 12, height: 12, background: 'rgba(244, 63, 94, 0.4)', borderRadius: 2 }}></span>
            Peak Risk Hours (Evening Peak SP 33-40)
          </div>
        </div>
        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
          Diurnal Pattern across 48 Half-Hour Settlement Periods
        </div>
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
              {val.toLocaleString()} MW
            </text>
          </g>
        ))}

        {/* Shaded Background for Evening Peak (SP 33 to 40) */}
        {profileData.length >= 40 && (
          <rect
            x={getX(32) - barW}
            y={margin.top}
            width={getX(39) - getX(32) + barW * 2}
            height={chartH}
            fill="rgba(244, 63, 94, 0.08)"
            stroke="rgba(244, 63, 94, 0.2)"
            strokeDasharray="2 2"
          />
        )}

        {/* Bars for MAE */}
        {profileData.map((d, i) => {
          const isPeak = d.settlement_period >= 33 && d.settlement_period <= 40;
          const barHeight = chartH - (getY(d.mae_mw) - margin.top);
          return (
            <rect
              key={d.settlement_period}
              x={getX(i) - barW / 2}
              y={getY(d.mae_mw)}
              width={barW}
              height={Math.max(barHeight, 2)}
              rx="2"
              fill={isPeak ? 'rgba(244, 63, 94, 0.7)' : 'rgba(56, 189, 248, 0.7)'}
              stroke={isPeak ? '#fb7185' : '#38bdf8'}
              strokeWidth="1"
              opacity={hoverIndex === null || hoverIndex === i ? 1.0 : 0.4}
              style={{ transition: 'opacity 0.2s' }}
            />
          );
        })}

        {/* X Axis Labels */}
        {profileData.map((d, i) => {
          if (i % 4 === 0 || i === profileData.length - 1) {
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
                  y={margin.top + chartH + 18}
                  textAnchor="middle"
                  className="chart-axis-label"
                >
                  SP {d.settlement_period}
                </text>
                <text
                  x={getX(i)}
                  y={margin.top + chartH + 30}
                  textAnchor="middle"
                  className="chart-axis-label"
                  style={{ fill: '#475569' }}
                >
                  {d.time_label}
                </text>
              </g>
            );
          }
          return null;
        })}

        {/* Overlay for mouse hover */}
        {profileData.map((d, i) => (
          <rect
            key={i}
            x={getX(i) - (chartW / profileData.length) / 2}
            y={margin.top}
            width={chartW / profileData.length}
            height={chartH}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoverIndex(i)}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hoverIndex !== null && profileData[hoverIndex] && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(getX(hoverIndex) / width) * 100}%`,
            top: `${(getY(profileData[hoverIndex].mae_mw) / height) * 100}%`
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
            Settlement Period {profileData[hoverIndex].settlement_period} ({profileData[hoverIndex].time_label} GMT)
          </div>
          <div style={{ fontSize: '0.74rem', color: '#38bdf8', marginBottom: 6 }}>
            {profileData[hoverIndex].period_type}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 3 }}>
            <span style={{ color: '#94a3b8' }}>Average MAE:</span>
            <span className="font-mono" style={{ fontWeight: 700, color: '#fff' }}>
              {profileData[hoverIndex].mae_mw} MW
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 3 }}>
            <span style={{ color: '#94a3b8' }}>Mean Bias:</span>
            <span
              className="font-mono"
              style={{
                fontWeight: 700,
                color: profileData[hoverIndex].mean_bias_mw > 0 ? '#fb7185' : '#34d399'
              }}
            >
              {profileData[hoverIndex].mean_bias_mw > 0 ? `+${profileData[hoverIndex].mean_bias_mw}` : profileData[hoverIndex].mean_bias_mw} MW
            </span>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 4, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Avg Generation:</span>
            <span className="font-mono" style={{ color: '#10b981', fontSize: '0.75rem' }}>
              {profileData[hoverIndex].avg_actual_mw?.toLocaleString()} MW
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
