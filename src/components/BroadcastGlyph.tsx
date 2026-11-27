type GlyphKind = 'archive' | 'unknown' | 'snow' | 'rain' | 'clear'

/** Stepped broadcast artwork; the forecast text carries the meaning. */
export function BroadcastGlyph({ kind }: { kind: GlyphKind }) {
  return (
    <svg className="broadcast-glyph" viewBox="0 0 32 32" shapeRendering="crispEdges" aria-hidden="true">
      {kind === 'archive' ? <>
        <path fill="var(--broadcast-cyan)" d="M4 4h24v5H4zM7 10h18v19H7z" />
        <path fill="var(--broadcast-white)" d="M5 9h22v19H5z" />
        <path fill="var(--broadcast-blue)" d="M9 14h14v3H9zM11 21h10v3H11z" />
        <path fill="var(--broadcast-yellow)" d="M2 2h24v3H2z" />
      </> : kind === 'unknown' ? <>
        <path fill="var(--broadcast-yellow)" d="M9 3h14v3h3v9h-4v3h-4v5h-5v-8h4v-3h4V8h-9v4H7V6h2zM13 27h5v5h-5z" />
      </> : kind === 'clear' ? <>
        <path fill="var(--broadcast-yellow)" d="M13 1h6v5h-6zM13 26h6v5h-6zM1 13h5v6H1zM26 13h5v6h-5zM5 5h5v5H5zM22 5h5v5h-5zM5 22h5v5H5zM22 22h5v5h-5zM11 8h10v3h3v10h-3v3H11v-3H8V11h3z" />
      </> : <>
        <path fill="var(--broadcast-cyan)" d="M7 8h5V4h11v5h4v4h4v10H3V12h4z" />
        <path fill="var(--broadcast-white)" d="M5 10h7V6h9v5h5v4h3v6H2v-7h3z" />
        {kind === 'snow'
          ? <path fill="var(--broadcast-yellow)" d="M7 24h2v2h2v2H9v2H7v-2H5v-2h2zM21 24h2v2h2v2h-2v2h-2v-2h-2v-2h2z" />
          : <path fill="var(--broadcast-cyan)" d="M8 24h3v5H8zM16 25h3v6h-3zM24 24h3v5h-3z" />}
      </>}
    </svg>
  )
}
