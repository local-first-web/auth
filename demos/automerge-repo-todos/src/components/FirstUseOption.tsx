export const FirstUseOption = ({ icon, label, buttonText, onSelect, autoFocus }: Props) => {
  return (
    <div className={`p-6`}>
      <div className="flex flex-col space-y-6 text-center basis-1/3">
        <span className="h-12 text-6xl">{icon}</span>
        <p className="h-18">{label}</p>
        <p>
          <button
            className="button button-sm button-primary"
            autoFocus={autoFocus}
            onClick={onSelect}
          >
            {buttonText}
          </button>
        </p>
      </div>
    </div>
  )
}
type Props = {
  icon: string
  label: React.ReactNode
  buttonText: string
  autoFocus?: boolean
  onSelect: () => void
  className?: string
}
