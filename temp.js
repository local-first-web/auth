const before = {
  payload: {
    type: 'ADD_MEMBER',
    payload: {
      member: {
        userName: '👨🏻‍🦲',
        keys: {
          type: 'MEMBER',
          name: '👨🏻‍🦲',
          generation: 0,
          encryption: 'yKv+w',
          signature: 'Na3bo',
        },
        roles: ['admin'],
        devices: [
          {
            userName: '👨🏻‍🦲',
            deviceId: '👨🏻‍🦲:laptop',
            keys: {
              type: 'DEVICE',
              name: '👨🏻‍🦲:laptop',
              generation: 0,
              encryption: 'oiUxf',
              signature: '4jMNZ',
            },
          },
        ],
      },
      roles: ['admin'],
      lockboxes: [
        {
          encryptionKey: { type: 'EPHEMERAL', name: 'EPHEMERAL', publicKey: '2Dezu' },
          recipient: {
            type: 'MEMBER',
            name: '👨🏻‍🦲',
            generation: 0,
            encryption: 'yKv+w',
            signature: 'Na3bo',
            publicKey: 'yKv+w',
          },
          contents: {
            type: 'ROLE',
            name: 'admin',
            generation: 0,
            encryption: '4gY2d',
            signature: '32DWq',
            publicKey: '4gY2d',
          },
          encryptedPayload: 'g6Vubrvn69K4mpU4eRBczUnNM18HQE+83oVclB1YmxpY0tlecA=',
        },
        {
          encryptionKey: { type: 'EPHEMERAL', name: 'EPHEMERAL', publicKey: 'QI1+G' },
          recipient: {
            type: 'MEMBER',
            name: '👨🏻‍🦲',
            generation: 0,
            encryption: 'yKv+w',
            signature: 'Na3bo',
            publicKey: 'yKv+w',
          },
          contents: {
            type: 'TEAM',
            name: 'TEAM',
            generation: 0,
            encryption: 'XVHx2',
            signature: 'y17C7',
            publicKey: 'XVHx2',
          },
          encryptedPayload: 'g6VubGmUE8IY8E+pPrr+IxrlKmiZyqP1kXeUHVibGljS2V5wA==',
        },
      ],
    },
    context: {
      member: {
        userName: '👩🏾',
        keys: {
          type: 'MEMBER',
          name: '👩🏾',
          generation: 0,
          encryption: 'xejko',
          signature: 'uUghF',
        },
        roles: [],
        devices: [
          {
            userName: '👩🏾',
            deviceId: '👩🏾:laptop',
            keys: {
              type: 'DEVICE',
              name: '👩🏾:laptop',
              generation: 0,
              encryption: 'ji5qu',
              signature: 'PNcTw',
            },
          },
        ],
      },
      device: {
        userName: '👩🏾',
        deviceId: '👩🏾:laptop',
        keys: {
          type: 'DEVICE',
          name: '👩🏾:laptop',
          generation: 0,
          encryption: 'ji5qu',
          signature: 'PNcTw',
        },
      },
    },
    timestamp: 1607339127939,
    prev: 'EwpSq',
  },
  signature: 'ffT1z',
  publicKey: 'uUghF',
}
const after = {
  payload: {
    type: 'ADD_MEMBER',
    payload: {
      member: {
        userName: '👨🏻‍🦲',
        keys: {
          type: 'MEMBER',
          name: '👨🏻‍🦲',
          generation: 0,
          encryption: 'yKv+w',
          signature: 'Na3bo',
        },
        roles: ['admin'],
        devices: [
          {
            userName: '👨🏻‍🦲',
            deviceId: '👨🏻‍🦲:laptop',
            keys: {
              type: 'DEVICE',
              name: '👨🏻‍🦲:laptop',
              generation: 0,
              encryption: 'oiUxf',
              signature: '4jMNZ',
            },
          },
          {
            userName: '👨🏻‍🦲',
            deviceId: "👨🏻‍🦲:👨🏻‍🦲's phone",
            keys: {
              type: 'DEVICE',
              name: "👨🏻‍🦲:👨🏻‍🦲's phone",
              generation: 0,
              encryption: '5oCMg',
              signature: '+Mg1G',
            },
          },
        ],
      },
      roles: ['admin'],
      lockboxes: [
        {
          encryptionKey: { type: 'EPHEMERAL', name: 'EPHEMERAL', publicKey: '2Dezu' },
          recipient: {
            type: 'MEMBER',
            name: '👨🏻‍🦲',
            generation: 0,
            encryption: 'yKv+w',
            signature: 'Na3bo',
            publicKey: 'yKv+w',
          },
          contents: {
            type: 'ROLE',
            name: 'admin',
            generation: 0,
            encryption: '4gY2d',
            signature: '32DWq',
            publicKey: '4gY2d',
          },
          encryptedPayload: 'g6Vubrvn69K4mpU4eRBczUnNM18HQE+83oVclB1YmxpY0tlecA=',
        },
        {
          encryptionKey: { type: 'EPHEMERAL', name: 'EPHEMERAL', publicKey: 'QI1+G' },
          recipient: {
            type: 'MEMBER',
            name: '👨🏻‍🦲',
            generation: 0,
            encryption: 'yKv+w',
            signature: 'Na3bo',
            publicKey: 'yKv+w',
          },
          contents: {
            type: 'TEAM',
            name: 'TEAM',
            generation: 0,
            encryption: 'XVHx2',
            signature: 'y17C7',
            publicKey: 'XVHx2',
          },
          encryptedPayload: 'g6VubGmUE8IY8E+pPrr+IxrlKmiZyqP1kXeUHVibGljS2V5wA==',
        },
      ],
    },
    context: {
      member: {
        userName: '👩🏾',
        keys: {
          type: 'MEMBER',
          name: '👩🏾',
          generation: 0,
          encryption: 'xejko',
          signature: 'uUghF',
        },
        roles: [],
        devices: [
          {
            userName: '👩🏾',
            deviceId: '👩🏾:laptop',
            keys: {
              type: 'DEVICE',
              name: '👩🏾:laptop',
              generation: 0,
              encryption: 'ji5qu',
              signature: 'PNcTw',
            },
          },
        ],
      },
      device: {
        userName: '👩🏾',
        deviceId: '👩🏾:laptop',
        keys: {
          type: 'DEVICE',
          name: '👩🏾:laptop',
          generation: 0,
          encryption: 'ji5qu',
          signature: 'PNcTw',
        },
      },
    },
    timestamp: 1607339127939,
    prev: 'EwpSq',
  },
  signature: 'ffT1z',
  publicKey: 'uUghF',
}
