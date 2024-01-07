import { AutomergeUrl } from '@automerge/automerge-repo'
import { useRepo } from '@automerge/automerge-repo-react-hooks'
import cx from 'classnames'
import { useRef, useState } from 'react'
import { useRootDocument } from '../hooks/useRootDocument'
import { ExtendedArray, Filter, TodoData } from '../types.js'
import { TeamAdmin } from './TeamAdmin.js'
import { Todo } from './Todo.js'
import { Card } from './Card'
import { Layout } from './Layout'

export function App() {
  const repo = useRepo()

  const newTodoInput = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState<Filter>(Filter.all)

  const [state, changeState] = useRootDocument()

  if (!state) return 'Loading...'

  const destroy = (url: AutomergeUrl) => {
    changeState(s => {
      const todos = s.todos as ExtendedArray<AutomergeUrl>
      const index = todos.findIndex(_ => _ === url)
      todos.deleteAt(index)
    })
  }

  const getFilteredTodos = async (filter: Filter) => {
    if (!state) return []
    return state.todos.filter(async url => {
      if (filter === Filter.all) return true
      const todo = await repo.find<TodoData>(url).doc()
      if (filter === Filter.completed) return todo?.completed
      if (filter === Filter.incomplete) return !todo?.completed
      return false
    })
  }

  const destroyCompleted = async () => {
    if (!state) return
    for (const url of await getFilteredTodos(Filter.completed)) {
      const todo = await repo.find<TodoData>(url).doc()
      if (todo?.completed) destroy(url)
    }
  }

  return (
    <div className="flex flex-row w-full ">
      <div className="w-1/4 bg-white h-full p-4">
        <TeamAdmin />
      </div>
      <div className="flex-grow ">
        <Layout>
          <div className="">
            <Card>
              {/* new todo form */}
              <header>
                <form
                  onSubmit={e => {
                    e.preventDefault()
                    if (!newTodoInput.current) return

                    const newTodoText = newTodoInput.current.value.trim()

                    // don't create empty todos
                    if (newTodoText.length === 0) return

                    const handle = repo.create<TodoData>()
                    const url = handle.url
                    handle.change(t => {
                      t.url = url
                      t.content = newTodoText
                      t.completed = false
                    })

                    // update state with new todo
                    changeState(s => {
                      s.todos.push(url)
                    })

                    // clear input
                    newTodoInput.current.value = ''
                  }}
                >
                  <input
                    className="w-full p-3 rounded-md"
                    placeholder="Add a new todo"
                    ref={newTodoInput}
                    autoFocus={true}
                  />
                </form>
              </header>

              {/* todos */}
              <section>
                <ul className="border-y divide-y divide-solid">
                  {state.todos.map(url => (
                    <Todo key={url} url={url} onDestroy={url => destroy(url)} filter={filter} />
                  ))}
                </ul>
              </section>

              {/* footer tools */}
              <footer className="py-3 flex justify-between items-center text-sm">
                {/* remaining count */}
                {/* <span className="flex-1">
              <strong>{incompleteCount}</strong>{" "}
              {pluralize(incompleteCount, "item")} left
            </span> */}

                {/* filter */}
                <ul className="flex-1 flex space-x-1 cursor-pointer">
                  {Object.keys(Filter).map(k => {
                    const key = k as Filter
                    const active = key === filter

                    const buttonStyle = cx({
                      'button button-sm ': true,
                      'button-white': !active,
                      'button-neutral': active,
                    })

                    return (
                      <li className="leading-none" key={`filter-${key}`}>
                        <button
                          className={buttonStyle}
                          onClick={e => {
                            e.preventDefault()
                            setFilter(key)
                          }}
                        >
                          {key}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <div className="flex-1 text-right">
                  <button
                    className={cx('button button-sm button-primary')}
                    onClick={e => {
                      e.preventDefault()
                      destroyCompleted()
                    }}
                  >
                    Clear completed
                  </button>
                </div>
              </footer>
            </Card>
          </div>
        </Layout>
      </div>
    </div>
  )
}
