import { useEffect, useState } from 'react'
import mermaid from 'mermaid'

export const useMermaid = (id: string, content: string, config: any = {}) => {
  const [svg, setSvg] = useState<string>()
  mermaid.mermaidAPI.initialize(config)

  useEffect(() => {
    mermaid.mermaidAPI.render(id, content, svgCode => setSvg(svgCode))
  }, [id, content, config])

  return svg
}
