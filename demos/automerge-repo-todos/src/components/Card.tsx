export const Card = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="border border-neutral-300 shadow-md rounded-md bg-white p-4">{children}</div>
  )
}
