'use client';
import dynamic from 'next/dynamic';

// The editor relies on canvas, IndexedDB and WebGL, so it renders on the client only.
const AppShell = dynamic(() => import('../components/AppShell.jsx'), { ssr: false, loading: () => <div style={{ color: '#8b95a5', padding: 24 }}>Loading editor…</div> });

export default function Page() {
  return <AppShell />;
}
