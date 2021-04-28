export const HideButton = ({ onClick }: HideButtonProps) => (
  <div className="HideButton opacity-0 group-hover:opacity-100">
    <button
      className="absolute top-0 right-0 p-1 m-2 leading-none opacity-25 rounded-full 
        text-white text-xs
        hover:opacity-75 
        focus:opacity-100 focus:outline-none focus:shadow-outline-neutral "
      onClick={onClick}
      title="Power off and hide this device"
    >
      🗙
    </button>
  </div>
)
interface HideButtonProps {
  onClick: () => void
}
