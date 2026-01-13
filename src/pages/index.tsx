import type { ReactElement } from 'react'
import Link from 'next/link'

export default function Home(): ReactElement {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Fractal Events API</h1>
      <p>This is an API-only service. No UI here.</p>
      <p>
        <Link href="/api/health">Health Check</Link>
      </p>
    </div>
  )
}
