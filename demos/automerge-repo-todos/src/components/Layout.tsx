export const Layout = ({ children }: Props) => {
  return (
    <div className=" h-screen bg-primary-50">
      <div className="flex flex-col gap-2 m-auto max-w-2xl py-4">{children}</div>
    </div>
  )
}

type Props = {
  children: React.ReactNode
}
