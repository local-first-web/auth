import { orderedDelivery } from '/connection/orderedDelivery'
import { arrayToMap } from '/util/arrayToMap'

const msgs = [
  { index: 0, payload: 'zero' },
  { index: 1, payload: 'one' },
  { index: 2, payload: 'two' },
  { index: 3, payload: 'three' },
  { index: 4, payload: 'four' },
]

describe('orderedDelivery', () => {
  describe('nextMessages', () => {
    const testCase = (queueIndexes: number[], nextIndex: number, expectedIndexes: number[]) => {
      const queue = msgs.filter(m => queueIndexes.includes(m.index)).reduce(arrayToMap('index'), {})
      const message = msgs[nextIndex]
      const actualIndexes = orderedDelivery(queue, message).nextMessages.map(m => m.index)
      expect(actualIndexes).toEqual(expectedIndexes)
    }

    test('a', () => testCase([], 0, [0]))
    test('b', () => testCase([], 1, []))
    test('c', () => testCase([0], 1, [1]))
    test('d', () => testCase([0], 2, []))

    test('e', () => testCase([0, 1, /**/ 3, 4], 2, [2, 3, 4]))
    test('f', () => testCase([0, 1, /*****/ 4], 3, []))
    test('g', () => testCase([0, 1, /*****/ 4], 2, [2]))

    test('h', () => testCase([0, 1, 2 /*****/], 3, [3]))
    test('i', () => testCase([0, 1, 2 /*****/], 4, []))
    test('j', () => testCase([0, 1, 2, /**/ 4], 3, [3, 4]))
  })
})
