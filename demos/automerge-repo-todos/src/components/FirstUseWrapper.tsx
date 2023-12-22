export const FirstUseWrapper = ({ children }: Props) => {
  return (
    <div className="flex h-screen w-full">
      <div className="flex flex-col m-auto justify-center items-center pb-24 ">{children}</div>
    </div>
  )
}

type Props = {
  children: React.ReactNode
}
