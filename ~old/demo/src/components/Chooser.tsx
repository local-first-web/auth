import { Select } from '@windmill/react-ui'
import { useRef } from 'react'
import { PeerMap } from '../peers'

export const Chooser = ({ onAdd, peers }: ChooserProps) => {
  const peerSelect = useRef() as React.MutableRefObject<HTMLSelectElement>

  const onChange = () => onAdd(peerSelect.current.value)

  return (
    <div className="Chooser group flex-grow">
      <Select
        ref={peerSelect}
        className="opacity-25 w-64 group-hover:opacity-100 h-10 font-normal text-lg"
        onChange={onChange}
        css=""
      >
        <option>Show device...</option>
        {Object.values(peers)
          .filter(p => !p.show)
          .map(p => (
            <option key={p.id} value={p.id}>
              {p.user.emoji} {p.device.emoji}
            </option>
          ))}
      </Select>
    </div>
  )
}

interface ChooserProps {
  onAdd: (id: string) => void
  peers: PeerMap
}
