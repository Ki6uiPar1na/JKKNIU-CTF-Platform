import { useState, useEffect } from 'react';
import api from '../../utils/api';
import AdminSidebar from '../../components/AdminSidebar';

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/logs?page=${p}&limit=20`);
      if (res.data.success) {
        setLogs(res.data.data);
        setTotalPages(res.data.pagination.total_pages);
        setPage(res.data.pagination.current_page);
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const formatDate = (d) => d ? new Date(d).toLocaleString() : '';

  return (
    <div className="d-flex">
      <AdminSidebar />
      <div className="flex-grow-1 p-4">
        <h2 className="fw-bold mb-4" style={{ letterSpacing: '-0.02em' }}>
          <i className="fas fa-history me-2" style={{ color: 'var(--accent)' }}></i>Admin Logs
        </h2>
        <div className="table-responsive">
          <table className="neon-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>#</th>
                <th style={{ width: '100px' }}>Admin</th>
                <th>Action</th>
                <th style={{ width: '100px' }}>Target</th>
                <th>Details</th>
                <th style={{ width: '160px' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center py-4"><div className="spinner-neon" style={{ margin: '0 auto' }}></div></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-4" style={{ color: 'var(--text-muted)' }}>No logs yet.</td></tr>
              ) : (
                logs.map((log, i) => (
                  <tr key={log._id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{(page - 1) * 20 + i + 1}</td>
                    <td className="fw-bold" style={{ fontSize: '0.85rem' }}>{log.admin_name}</td>
                    <td style={{ fontSize: '0.85rem' }}>{log.action}</td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.15)' }}>
                        {log.target_type || '-'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.details || '-'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDate(log.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="d-flex justify-content-center gap-2 mt-4">
            <button className="btn btn-neon-outline btn-sm" disabled={page <= 1} onClick={() => load(page - 1)}>Previous</button>
            <span className="align-self-center" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
            <button className="btn btn-neon-outline btn-sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
