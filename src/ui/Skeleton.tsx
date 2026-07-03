// Esqueletos de carga con shimmer (21st.dev/Loaders) para el fallback de rutas
// lazy: en vez de un «Cargando…» plano, la silueta de la página que viene.
export function Skeleton({ w, h = 14, r = 8, style }: { w?: number | string; h?: number; r?: number; style?: React.CSSProperties }) {
  return <span className="sk" style={{ width: w ?? '100%', height: h, borderRadius: r, ...style }} />
}

/** Silueta genérica de página (título + KPIs + panel) para Suspense. */
export function RouteSkeleton() {
  return (
    <div aria-hidden style={{ padding: '4px 0' }}>
      <Skeleton w={340} h={26} style={{ marginBottom: 10 }} />
      <Skeleton w={520} h={12} style={{ marginBottom: 18 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16 }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={64} r={14} />)}
      </div>
      <Skeleton h={320} r={14} />
    </div>
  )
}
