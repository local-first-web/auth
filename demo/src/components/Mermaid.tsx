import React, { FC } from 'react'
import { useMermaid } from '../hooks/useMermaid'

export const Mermaid: FC<MermaidProps> = ({ id, chart, config = {} }) => {
  const svg = useMermaid(id, chart, config)
  if (!svg) {
    return <div>...</div>
  } else {
    return <div className="Mermaid" dangerouslySetInnerHTML={{ __html: svg }} />
  }
}

interface MermaidProps {
  id: string
  chart: string
  config: any
}
