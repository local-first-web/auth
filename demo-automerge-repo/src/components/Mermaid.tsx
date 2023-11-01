import mermaid from 'mermaid'
import { useEffect, useState } from 'react'

export type MermaidProps = {
  id: string
  chart: string
  config: any
}

export const Mermaid = ({ id, chart, config = {} }: MermaidProps) => {
  const [svg, setSvg] = useState('')
  mermaid.mermaidAPI.initialize(config)

  useEffect(() => {
    if (chart === '') return
    mermaid.render(id, chart).then(({ svg }) => setSvg(svg))
  }, [chart])

  return (
    <div
      key={id}
      className="Mermaid"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
