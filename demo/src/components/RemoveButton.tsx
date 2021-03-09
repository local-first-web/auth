export const RemoveButton = ({ onClick }: RemoveButtonProps) => (
  <div className="RemoveButton opacity-0 group-hover:opacity-100">
    <button
      className="absolute top-0 right-0 p-1 m-2 leading-none opacity-25 rounded-full 
        text-white text-xs
        hover:opacity-75 
        focus:opacity-100 focus:outline-none focus:shadow-outline-neutral "
      onClick={onClick}
    >
      🗙
    </button>
  </div>
)
interface RemoveButtonProps {
  onClick: () => void
}
