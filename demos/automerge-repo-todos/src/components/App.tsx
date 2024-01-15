import { Card } from './Card'
import { Layout } from './Layout'
import { TeamAdmin } from './TeamAdmin.js'
import { Todos } from './Todos'

export function App() {
  return (
    <div className="flex flex-row w-full ">
      <div className="w-1/4 bg-white h-full p-4">
        <TeamAdmin />
      </div>
      <div className="flex-grow ">
        <Layout>
          <Card>
            <Todos />
          </Card>
        </Layout>
      </div>
    </div>
  )
}
