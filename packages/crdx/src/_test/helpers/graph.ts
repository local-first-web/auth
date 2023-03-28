import { append } from '/graph/append'
import { createGraph } from '/graph/createGraph'
import { merge } from '/graph/merge'
import { Action, Link, LinkBody, Graph } from '/graph/types'
import { KeysetWithSecrets } from '/keyset'
import { setup, TEST_GRAPH_KEYS as keys } from '/test/helpers/setup'

const { alice } = setup('alice')

export const getPayloads = (sequence: Link<XAction, any>[]) =>
  sequence //
    .filter(link => link.body.prev.length) // omit root link
    .filter(link => link.isInvalid !== true) // omit invalid links
    .map(link => (link.body as LinkBody<XAction, any>).payload) // pull out payloads
    .join('') // return as single string

export const findByPayload = (graph: Graph<XAction, any>, payload: XAction['payload']) => {
  const links = Object.values(graph.links)
  return links.find(n => n.body.payload === payload) as Link<XAction, any>
}

// ignore coverage
export const byPayload = (a: Link<XAction, any>, b: Link<XAction, any>) => {
  return a.body.payload < b.body.payload ? -1 : a.body.payload > b.body.payload ? 1 : 0
}

export const buildGraph = (type: string) => {
  let root = createGraph<XAction>({ user: alice, name: 'root', keys })
  switch (trim(type)) {
    // one link
    case 'a': {
      let a = appendLink(root, 'a', keys)
      return a
    }

    // no branches
    case trim(`a ─ b ─ c`): {
      let a = appendLink(root, 'a', keys)
      let b = appendLink(a, 'b', keys)
      let c = appendLink(b, 'c', keys)
      return c
    }

    // simple open
    case trim(`
            ┌─ b
         a ─┤
            └─ c
      `): {
      let a = appendLink(root, 'a', keys)
      let b = appendLink(a, 'b', keys)
      let c = appendLink(a, 'c', keys)
      return merge(b, c)
    }

    // simple closed
    case trim(`
            ┌─ b ─ c ─┐
         a ─┤         ├─ e   
            └─── d ───┘

      `): {
      let a = appendLink(root, 'a', keys)
      let b = appendLink(a, 'b', keys)
      let c = appendLink(b, 'c', keys)
      let d = appendLink(a, 'd', keys)
      let e = appendLink(merge(c, d), 'e', keys)
      return e
    }

    // double closed
    case trim(`
            ┌─ b ─ c ─┐     ┌─ f ─ g ─┐
         a ─┤         ├─ e ─┤         ├─ i    
            └─── d ───┘     └─── h ───┘

      `): {
      let a = appendLink(root, 'a', keys)
      let b = appendLink(a, 'b', keys)
      let c = appendLink(b, 'c', keys)
      let d = appendLink(a, 'd', keys)
      let e = appendLink(merge(c, d), 'e', keys)
      let f = appendLink(e, 'f', keys)
      let g = appendLink(f, 'g', keys)
      let h = appendLink(e, 'h', keys)
      let i = appendLink(merge(g, h), 'i', keys)
      return i
    }

    // complex
    case trim(`
                          ┌─ e ─ g ─┐
                ┌─ c ─ d ─┤         ├─ o ─┐
         a ─ b ─┤         └─── f ───┤     ├─ n
                ├──── h ──── i ─────┘     │
                └───── j ─── k ── l ──────┘
      `): {
      let a = appendLink(root, 'a', keys)
      let b = appendLink(a, 'b', keys)
      let c = appendLink(b, 'c', keys)
      let d = appendLink(c, 'd', keys)
      let e = appendLink(d, 'e', keys)
      let g = appendLink(e, 'g', keys)

      let f = appendLink(d, 'f', keys)

      let h = appendLink(b, 'h', keys)
      let i = appendLink(h, 'i', keys)

      let j = appendLink(b, 'j', keys)
      let k = appendLink(j, 'k', keys)
      let l = appendLink(k, 'l', keys)

      let o = appendLink(merge(g, merge(f, i)), 'o', keys)

      let n = appendLink(merge(o, l), 'n', keys)
      return n
    }

    // tricky
    case trim(`
                          ┌─── h ────┐
                ┌─ c ─ e ─┤          ├─ k
         a ─ b ─┤         └── i ─ j ─┘
                └── d ────────┘
      `): {
      let a = appendLink(root, 'a', keys)
      let b = appendLink(a, 'b', keys)
      let c = appendLink(b, 'c', keys)
      let e = appendLink(c, 'e', keys)
      let h = appendLink(e, 'h', keys)

      let d = appendLink(b, 'd', keys)

      let i = appendLink(merge(e, d), 'i', keys)
      let j = appendLink(i, 'j', keys)

      let k = appendLink(merge(h, j), 'k', keys)
      return k
    }

    // multiple heads
    case trim(`
                          ┌─ e ─ g ─┐
                ┌─ c ─ d ─┤         ├─ o 
         a ─ b ─┤         └─── f ───┘     
                ├─ h ─ i  
                └─ j 
      `): {
      let a = appendLink(root, 'a', keys)
      let b = appendLink(a, 'b', keys)
      let c = appendLink(b, 'c', keys)
      let d = appendLink(c, 'd', keys)
      let e = appendLink(d, 'e', keys)
      let g = appendLink(e, 'g', keys)
      let f = appendLink(d, 'f', keys)
      let o = appendLink(merge(g, f), 'o', keys)

      let h = appendLink(b, 'h', keys)
      let i = appendLink(h, 'i', keys)

      let j = appendLink(b, 'j', keys)

      return merge(o, merge(i, j))
    }

    default:
      // ignore coverage
      throw new Error('unknown graph')
  }
}

export type XAction =
  | Action
  | {
      type: 'X'
      payload: string
    }
export type XLink = Link<XAction, {}>

export const appendLink = (graph: Graph<XAction, any>, payload: string, keys: KeysetWithSecrets) =>
  append({
    graph,
    action: { type: 'X', payload } as XAction,
    user: alice,
    keys,
  })

export const trim = (s: string) => s.replace(/\s*/g, '')
