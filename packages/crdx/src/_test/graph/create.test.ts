import { TEST_GRAPH_KEYS as keys, setup } from "@test/helpers/setup"
import { describe, expect, test } from "vitest"
import {
  createGraph,
  deserialize,
  getHead,
  getRoot,
  serialize,
} from "@/graph/index.js"
import { validate } from "@/validator/index.js"
import "@test/helpers/expect/toBeValid.js"

const { alice } = setup("alice")
const defaultUser = alice

const _ = expect.objectContaining

describe("graphs", () => {
  test("create", () => {
    const graph = createGraph({ user: defaultUser, name: "a", keys })
    const expected = _({ body: _({ payload: _({ name: "a" }) }) })
    expect(getRoot(graph)).toEqual(expected)
    expect(getHead(graph)[0]).toEqual(expected)
  })

  test("serialize/deserialize", () => {
    // 👨🏻‍🦲 Bob saves a graph to a file and loads it later
    const graph = createGraph({ user: defaultUser, name: "Spies Я Us", keys })

    // serialize
    const graphJson = serialize(graph)

    // deserialize
    const rehydratedGraph = deserialize(graphJson, keys)

    expect(validate(rehydratedGraph)).toBeValid()
  })
})
