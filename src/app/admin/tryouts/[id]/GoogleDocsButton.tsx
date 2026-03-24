'use client';

import { useState } from 'react';

export default function GoogleDocsButton({ 
  tryoutId, 
  googleDocUrl 
}: { 
  tryoutId: string; 
  googleDocUrl?: string | null; 
}) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/export/tryout/${tryoutId}/googledocs`, { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.reload();
      } else {
        alert(data.error || 'Gagal ekspor');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {googleDocUrl ? (
        <a 
          href={googleDocUrl} 
          target="_blank" 
          rel="noreferrer" 
          className="btn btn-outline" 
          style={{ 
            background: '#f8f9fa', 
            color: '#1a73e8', 
            borderColor: '#dadce0', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.375rem', 
            textDecoration: 'none' 
          }}
        >
          <img src="https://www.gstatic.com/images/branding/product/1x/docs_2020q4_48dp.png" alt="Google Docs" style={{ width: '18px' }} />
          Buka di Google Docs
        </a>
      ) : null}
      
      <button 
        onClick={handleExport}
        disabled={loading}
        className="btn btn-primary" 
        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
      >
        {loading ? '⏳ Memproses...' : (
          <>
            🚀 {googleDocUrl ? 'Update' : 'Ekspor ke'} Google Docs
          </>
        )}
      </button>
    </>
  );
}
