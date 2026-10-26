import React, { useState } from 'react';
import { Download, Search, CheckCircle, AlertCircle } from 'lucide-react';

export default function DataTable({ points, deliveryDate, resolution }) {
  const [filterText, setFilterText] = useState('');

  if (!points || points.length === 0) {
    return <div className="loading-box">No tabular data available.</div>;
  }

  const filteredPoints = points.filter(p => {
    if (!filterText) return true;
    return (
      p.time_label?.toLowerCase().includes(filterText.toLowerCase()) ||
      String(p.settlement_period || '').includes(filterText) ||
      (p.sp_range && p.sp_range.toLowerCase().includes(filterText.toLowerCase()))
    );
  });

  const exportCSV = () => {
    const headers = [
      'Period',
      'Time (GMT)',
      'Wind Actual (MW)',
      'Day-Ahead Forecast (MW)',
      'Delta Error (MW)',
      'Abs Error (%)',
      'Publish Time'
    ];
    const rows = points.map(p => [
      p.settlement_period ? `SP ${p.settlement_period}` : p.sp_range,
      p.time_label,
      p.actual_mw ?? '',
      p.forecast_mw ?? '',
      p.error_mw ?? '',
      p.pct_error ?? '',
      p.publish_time ?? ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AeroCast_Wind_Procurement_${deliveryDate}_${resolution}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card-alt)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', width: 280 }}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="Search period or time (e.g. 14:00, SP 28)..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.82rem', outline: 'none', width: '100%' }}
          />
        </div>

        <button
          onClick={exportCSV}
          className="sync-btn"
          style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.3)' }}
        >
          <Download size={16} /> Export to CSV
        </button>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Clock Time</th>
              <th>Actual Generation (MW)</th>
              <th>Day-Ahead Forecast (MW)</th>
              <th>Forecast Error (MW)</th>
              <th>Abs Error %</th>
              <th>Cutoff Publication</th>
              <th>Direction</th>
            </tr>
          </thead>
          <tbody>
            {filteredPoints.map((p, idx) => {
              const isOver = p.error_mw > 0;
              return (
                <tr key={idx}>
                  <td className="font-mono" style={{ fontWeight: 600 }}>
                    {p.settlement_period ? `SP ${p.settlement_period}` : p.sp_range}
                  </td>
                  <td className="font-mono" style={{ color: '#94a3b8' }}>
                    {p.time_label} GMT
                  </td>
                  <td className="font-mono" style={{ color: '#10b981', fontWeight: 600 }}>
                    {p.actual_mw !== null ? `${p.actual_mw.toLocaleString()} MW` : 'N/A'}
                  </td>
                  <td className="font-mono" style={{ color: '#38bdf8', fontWeight: 600 }}>
                    {p.forecast_mw !== null ? `${p.forecast_mw.toLocaleString()} MW` : 'N/A'}
                  </td>
                  <td className="font-mono" style={{ fontWeight: 700, color: isOver ? '#fb7185' : '#34d399' }}>
                    {p.error_mw !== null ? (isOver ? `+${p.error_mw.toLocaleString()}` : `${p.error_mw.toLocaleString()}`) : 'N/A'} MW
                  </td>
                  <td className="font-mono" style={{ color: '#e2e8f0' }}>
                    {p.pct_error !== null ? `${p.pct_error}%` : 'N/A'}
                  </td>
                  <td className="font-mono" style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    {p.publish_time ? p.publish_time.replace('T', ' ').replace('Z', '') : 'N/A'}
                  </td>
                  <td>
                    {p.error_mw !== null && (
                      <span className={`badge ${isOver ? 'badge-danger' : 'badge-success'}`}>
                        {isOver ? 'Over-forecast' : 'Under-forecast'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
