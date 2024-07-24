#! /usr/bin/env ts-node

import { createLibp2p, Libp2p } from 'libp2p';
import { bootstrap } from '@libp2p/bootstrap';
import { tcp } from '@libp2p/tcp';
import { echo } from '@libp2p/echo';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from '@libp2p/peer-id-factory';
import { base64 } from 'multiformats/bases/base64';
import { createHelia, Helia } from 'helia';
import { createOrbitDB, Events, OrbitDB, LogEntry } from '@orbitdb/core';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { identify } from '@libp2p/identify';
import fs from 'fs';
import { EventEmitter } from 'events';
import * as Auth from '@localfirst/auth'
import { ConnectionEvents } from '@localfirst/auth'
import type {
    Connection,
    PeerId,
    PeerStore,
    ComponentLogger,
    Topology,
    Stream
} from '@libp2p/interface'
import type { ConnectionManager, IncomingStreamData, Registrar } from '@libp2p/interface-internal'
import { pipe } from 'it-pipe'
import { encode, decode } from 'it-length-prefixed'
import { pushable, type Pushable } from 'it-pushable'
import type { Uint8ArrayList } from 'uint8arraylist'
import map from 'it-map'
import { SigChain } from './auth/chain.js'
import { UserService } from './auth/services/members/userService.js';
import { sleep } from './utils/utils.js';
import { EncryptionScopeType } from './auth/services/crypto/types.js';

class Storage {
    private authContext: Auth.Context | null
    private context: Auth.LocalUserContext | null
    private sigChain: SigChain | null

    constructor() {        
        this.authContext = null
        this.context = null
        this.sigChain = null
    }

    public setAuthContext(context: Auth.Context) {
        this.authContext = context
    }

    public setSigChain(sigChain: SigChain) {
        this.sigChain = sigChain
    }

    public setContext(context: Auth.LocalUserContext) {
        this.context = context
    }

    public getAuthContext(): Auth.Context | null {
        return this.authContext
    }

    public getSigChain(): SigChain | null {
        return this.sigChain
    }

    public getContext(): Auth.LocalUserContext | null {
        return this.context
    }
}

interface Libp2pAuthComponents {
    peerId: PeerId
    peerStore: PeerStore
    registrar: Registrar
    connectionManager: ConnectionManager
    logger: ComponentLogger
}

// Implementing local-first-auth as a service just to get started. I think we
// likely want to integrate it in a custom Transport/Muxer.
class Libp2pAuth {
    private readonly protocol: string
    private readonly components: Libp2pAuthComponents
    private storage: Storage
    private authConnections: Record<string, Auth.Connection>
    private outboundStreamQueue: Pushable<{ peerId: PeerId, connection: Connection }>
    private outboundStreams: Record<string, Pushable<Uint8Array | Uint8ArrayList>>
    private inboundStreams: Record<string, Stream>

    constructor(storage: Storage, components: Libp2pAuthComponents) {
        this.protocol =  '/local-first-auth/1.0.0'
        this.components = components
        this.storage = storage
        this.authConnections = {}
        this.outboundStreamQueue = pushable<{ peerId: PeerId, connection: Connection }>({ objectMode: true })
        this.outboundStreams = {}
        this.inboundStreams = {}

        pipe(
            this.outboundStreamQueue,
            async (source) => {
                for await (const { peerId, connection } of source) {
                    await this.openOutboundStream(peerId, connection)
                }
            }
        ).catch((e) => { console.error('Outbound stream queue error', e) })
    }

    async start() {
        console.log('Auth service starting')

        const topology: Topology = {
            onConnect: this.onPeerConnected.bind(this),
            onDisconnect: this.onPeerDisconnected.bind(this),
            notifyOnTransient: false,
        }

        const registrar = this.components.registrar
        await registrar.register(this.protocol, topology)
        await registrar.handle(this.protocol, this.onIncomingStream.bind(this), {
            runOnTransientConnection: false
        })
    }

    async stop() {
        // TODO
    }

    private async openOutboundStream(peerId: PeerId, connection: Connection) {
        if (peerId.toString() in this.outboundStreams) {
            return
        }

        console.log('Opening outbound stream for peer', peerId.toString())
        const outboundStream = await connection.newStream(this.protocol, {
            runOnTransientConnection: false
        })
        const outboundPushable: Pushable<Uint8Array | Uint8ArrayList> = pushable()
        this.outboundStreams[peerId.toString()] = outboundPushable

        pipe(
            outboundPushable,
            outboundStream
        ).catch((e: Error) => console.error(e))

        this.authConnections[peerId.toString()].start()
    }

    private sendMessage(peerId: PeerId, message: Uint8Array) {
        this.outboundStreams[peerId.toString()]?.push(
            // length-prefix encoded
            encode.single(message)
        )
    }

    // NOTE: This is not awaited by the registrar
    private async onPeerConnected(peerId: PeerId, connection: Connection) {
        console.log('Peer connected!')

        // https://github.com/ChainSafe/js-libp2p-gossipsub/issues/398
        if (connection.status !== 'open') {
            return
        }

        if (peerId.toString() in this.authConnections) {
            await connection.close()
            return
        }

        const context = this.storage.getAuthContext()
        if (!context) {
            throw new Error('Auth context required to connect to peer')
        }

        this.outboundStreamQueue.push({ peerId, connection })

        const authConnection = new Auth.Connection({
            context,
            sendMessage: (message: Uint8Array) => {
                this.sendMessage(peerId, message)
            },
        })

        // TODO: Listen for updates to context and update context in storage
        authConnection.on('joined', ({ team, user }) => {
            console.log(`${user.userId}: Joined team ${team.teamName}!`)
            if (this.storage.getSigChain() == null) {
                console.log(`${user.userId}: Creating SigChain for user with name ${user.userName} and team name ${team.teamName}`)
                const context = this.storage.getContext()!
                this.storage.setSigChain(SigChain.createFromTeam(team, context).sigChain)
                console.log(`${user.userId}: Updating auth context`)
                this.storage.setAuthContext({
                    user: context.user,
                    device: context.device,
                    team
                })
            }
        })

        authConnection.on(
            'change', 
            (summary: string) => 
                console.log(
                    `${this.storage.getContext()?.user.userName}: Change ${summary}`
                )
        )

        authConnection.on(
            'updated', (head: string[]) => console.log(`${this.storage.getContext()?.user.userName}: Chain updated!  New head: ${JSON.stringify(head)}`)
        )

        this.authConnections[peerId.toString()] = authConnection
    }

    private onPeerDisconnected(peerId: PeerId): void {
        // TODO
    }

    private async onIncomingStream({ stream, connection }: IncomingStreamData) {
        const peerId = connection.remotePeer

        const oldStream = this.inboundStreams[peerId.toString()]
        if (oldStream) {
            oldStream.close().catch(e => {
                oldStream.abort(e)
            })
        }

        pipe(
            stream,
            (source) => decode(source),
            async (source) => {
                for await (const data of source) {
                    try {
                        this.authConnections[peerId.toString()].deliver(data.subarray())
                    } catch (e) {
                        console.error(e)
                    }
                }
            }
        )

        this.inboundStreams[peerId.toString()] = stream
        console.log('New incoming stream for peer', peerId.toString())

        this.outboundStreamQueue.push({ peerId, connection })
    }
}

const libp2pAuth = (storage: Storage): ((components: Libp2pAuthComponents) => Libp2pAuth) => {
    return (components: Libp2pAuthComponents) => new Libp2pAuth(storage, components)
}

class Libp2pService {

    peerName: string
    libp2p: Libp2p | null
    storage: Storage

    constructor(peerName: string, storage: Storage) {
        this.peerName = peerName
        this.libp2p = null
        this.storage = storage
    }

    /**
     * Get a persistent peer ID for a given name.
     */
    async getPeerId() {
        let peerIdFilename = '.peerId.' + this.peerName;
        let peerIdB64;

        try {
            peerIdB64 = fs.readFileSync(peerIdFilename, 'utf8');
        } catch (e) {
            console.error(e);
        }

        if (!peerIdB64) {
            console.log('Creating peer ID');
            const peerId = await createEd25519PeerId();
            const peerIdBytes = exportToProtobuf(peerId);
            peerIdB64 = base64.encoder.encode(peerIdBytes);
        }

        try {
            fs.writeFileSync(peerIdFilename, peerIdB64);
        } catch (e) {
            console.error(e);
        }

        return await createFromProtobuf(base64.decoder.decode(peerIdB64));
    }

    async init() {
        console.log('Starting libp2p client');

        const peerId = await this.getPeerId();

        this.libp2p = await createLibp2p({
            peerId,
            addresses: {
                // accept TCP connections on any port
                listen: ['/ip4/127.0.0.1/tcp/0']
            },
            transports: [tcp()],
            connectionEncryption: [noise()],
            streamMuxers: [yamux()],
            peerDiscovery: [
                bootstrap({
                    list: [
                        '/ip4/127.0.0.1/tcp/8088/p2p/12D3KooWNYYYUtuxvmH7gsvApKE6YoiqBWNgZ6x3BBpea3RP1jTv'
                    ],
                    timeout: 1000, // in ms,
                    tagName: 'bootstrap',
                    tagValue: 50,
                    tagTTL: 120000 // in ms
                })
            ],
            services: {
                echo: echo(),
                pubsub: gossipsub({
                    // neccessary to run a single peer
                    allowPublishToZeroTopicPeers: true
                }),
                identify: identify(),
                auth: libp2pAuth(this.storage)
            }
        });

        console.log('Peer ID: ', peerId.toString());

        return this.libp2p;
    }

    async close() {
        console.log('Closing libp2p');
        await this.libp2p?.stop();
    }
}

class OrbitDbService {

    libp2pService: Libp2pService
    ipfs: Helia | null
    orbitDb: OrbitDB | null

    constructor(libp2pService: Libp2pService) {
        this.libp2pService = libp2pService;
        this.ipfs = null;
        this.orbitDb = null;
    }

    async init() {
        console.log('Initializing OrbitDB')
        if (!this.libp2pService.libp2p) {
            throw new Error('Cannot initialize OrbitDB, libp2p instance required')
        }
        this.ipfs = await createHelia({ libp2p: this.libp2pService.libp2p })
        this.orbitDb = await createOrbitDB({ ipfs: this.ipfs, directory: this.libp2pService.peerName })
    }

    async createDb(dbName: string) {
        if (!this.orbitDb) {
            throw new Error('Must call init before creating a DB')
        }
        const db = new Db(this.orbitDb, dbName);
        await db.init();

        return db;
    }

    async close() {
        console.log('Closing OrbitDB');
        await this.orbitDb?.stop();
        await this.ipfs?.stop();
    }
}

class Db extends EventEmitter {

    orbitDb: OrbitDB
    dbName: string
    db: Events | null

    constructor(orbitDb: OrbitDB, dbName: string) {
        super();

        this.orbitDb = orbitDb;
        this.dbName = dbName;
        this.db = null;
    }

    async init() {
        // Seems like we can improve the type definitions
        this.db = await this.orbitDb.open(this.dbName) as unknown as Events;

        this.db.events.on('update', async (entry: LogEntry) => {
            this.emit('update', entry);
        });

        return this.db;
    }

    async close() {
        console.log('Closing DB');
        await this.db?.close();
    }
}

const main = async () => {
    const teamName = 'Test'
    const username1 = 'isla'
    const username2 = 'isntla'
    const peerId1 = 'peer1'
    const peerId2 = 'peer2'

    // Peer 1
    const storage1 = new Storage()

    const { 
        context: founderContext,
        sigChain
    } = SigChain.create(teamName, username1)

    storage1.setContext(founderContext)
    storage1.setAuthContext({ ...founderContext, team: sigChain.team })
    storage1.setSigChain(sigChain)

    const peer1 = new Libp2pService(peerId1, storage1);
    await peer1.init();

    const { seed } = sigChain.invites.create()

    // const orbitDb1 = new OrbitDbService(peer1);
    // await orbitDb1.init();

    // const db1 = await orbitDb1.createDb('messages');

    // Peer 2
    const storage2 = new Storage()
    const prospectiveUser = UserService.createFromInviteSeed(username2, seed)
    storage2.setContext(prospectiveUser.context)
    storage2.setAuthContext({
        ...prospectiveUser.context,
        invitationSeed: seed
    })
    const peer2 = new Libp2pService(peerId2, storage2);
    await peer2.init();

    // const orbitDb2 = new OrbitDbService(peer2);
    // await orbitDb2.init();

    // const db2 = await orbitDb1.createDb(db1.db?.address || '');

    // Test
    // db2.on('update', (entry) => { console.log('Peer2: Received: ', entry.payload.value); });
    for (let addr of peer2.libp2p?.getMultiaddrs() ?? []) {
     await peer1.libp2p?.dial(addr);
    }
    // console.log('Peer1: Adding entry');
    // await db1.db?.add("Hello world");

    // await db1.close();
    // await orbitDb1.close();
    // await peer1.close();

    await sleep(3000)
    const channelName = 'foobar'
    peer1.storage.getSigChain()!.channels.createPrivateChannel(channelName, peer2.storage.getContext()!)
    peer1.storage.getSigChain()!.channels.addMemberToPrivateChannel(peer2.storage.getContext()!.user.userId, channelName)

    await sleep(3000)
    const enc = peer2.storage.getSigChain()!.crypto.encryptAndSign('this is a message', { type: EncryptionScopeType.CHANNEL, name: channelName }, storage2.getContext()!)
    const dec = peer1.storage.getSigChain()!.crypto.decryptAndVerify(enc.encrypted, enc.signature, storage1.getContext()!)
    console.log(dec)
};

main().then().catch(console.error);
