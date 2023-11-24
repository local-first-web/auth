import { describe, expect, test } from 'vitest'
import { orderedDelivery } from 'connection/orderedDelivery.js'
import { arrayToMap } from 'util/arrayToMap.js'

const msgs = [
  { index: 0, payload: 'zero' },
  { index: 1, payload: 'one' },
  { index: 2, payload: 'two' },
  { index: 3, payload: 'three' },
  { index: 4, payload: 'four' },
]

describe('ordered delivery', () => {
  // prettier-ignore
  const testCases = [
    // prevQueue: the queue of messages that have already been delivered
    // next:      the index of the newly arrived message
    // expNext:   the next messages to be delivered
    // expQueue:  the updated queue
    { prevQueue: [          ],  next: 0,  expNext: [0       ],  expQueue: [0             ] },
    { prevQueue: [          ],  next: 1,  expNext: [        ],  expQueue: [1             ] },
    { prevQueue: [   1      ],  next: 3,  expNext: [        ],  expQueue: [1, 3          ] },
    { prevQueue: [0         ],  next: 1,  expNext: [1       ],  expQueue: [0, 1          ] },
    { prevQueue: [0         ],  next: 2,  expNext: [        ],  expQueue: [0, 2          ] },
    { prevQueue: [0, 1, 3, 4],  next: 2,  expNext: [2, 3, 4 ],  expQueue: [0, 1, 2, 3, 4 ] },
    { prevQueue: [0, 1,    4],  next: 3,  expNext: [        ],  expQueue: [0, 1, 3, 4    ] },
    { prevQueue: [0, 1,    4],  next: 2,  expNext: [2       ],  expQueue: [0, 1, 2, 4    ] },
    { prevQueue: [0, 1, 2   ],  next: 3,  expNext: [3       ],  expQueue: [0, 1, 2, 3    ] },
    { prevQueue: [0, 1, 2   ],  next: 4,  expNext: [        ],  expQueue: [0, 1, 2, 4    ] },
    { prevQueue: [0, 1, 2, 4],  next: 3,  expNext: [3, 4    ],  expQueue: [0, 1, 2, 3, 4 ] },
  ]

  for (const { prevQueue, next, expNext, expQueue } of testCases) {
    test(`queue: [${prevQueue.join(',')}], next: ${next}`, () => {
      const prevQueueMsgs = msgs //
        .filter(m => prevQueue.includes(m.index))
        .reduce(arrayToMap('index'), {})
      const message = msgs[next]
      const { queue: _queue, nextMessages } = orderedDelivery(prevQueueMsgs, message)
      const actualNext = nextMessages.map(m => m.index)
      const actualQueue = Object.values(_queue).map(m => m.index)
      expect(actualNext).toEqual(expNext)
      expect(actualQueue).toEqual(expQueue)
    })
  }
})
