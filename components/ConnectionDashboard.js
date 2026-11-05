
'use client';

import { useEffect, useState } from 'react';

export default function ConnectionDashboard() {
  const [status, setStatus] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);
  const [error, setError] = useState('');

  async function refresh() {
    try {
      if (!window.electron?.getDPIStatus) {
        throw new Error('Electron bağlantısı bulunamadı.');
      }

      const result = await window.electron.getDPIStatus();
      setStatus(result);
      setCheckedAt(new Date());
      setError('');
    } catch {
      setError('Bağlantı durumu okunamadı.');
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, []);

  const label = !status
    ? 'Kontrol ediliyor'
    : status.starting
      ? 'Başlatılıyor'
      : !status.active
        ? 'Koruma kapalı'
        : status.notRouting || status.offline ||
          status.ownServerDown
          ? 'Bağlantı sorunu olabilir'
          : 'Koruma aktif';

  return (
    <section
      className="rounded-xl border p-4 space-y-3"
      style={{
        borderColor: 'var(--line)',
        background: 'var(--bg-sunk)',
        color: 'var(--text)'
      }}
    >
      <h2 className="font-semibold">
        Gelişmiş Bağlantı Paneli
      </h2>

      <div role="status" aria-live="polite">
        <p className="text-xs opacity-70">Koruma durumu</p>
        <p className="font-medium">{label}</p>
      </div>

      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}

      <p className="text-xs opacity-70">
        Son kontrol:{' '}
        {checkedAt
          ? checkedAt.toLocaleTimeString('tr-TR')
          : 'Henüz kontrol edilmedi'}
      </p>

      <button
        type="button"
        onClick={refresh}
        className="rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: 'var(--line)' }}
      >
        Şimdi yenile
      </button>
    </section>
  );
}
