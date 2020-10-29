import { base64, hash, signatures } from '@herbcaudill/crypto'
import { LocalUserContext, redactContext } from '/context'
import { NodeBody, PartialNodeBody, SignedNode } from '/graph/types'
import { Hash, HashPurpose } from '/util'

const { LINK_TO_PREVIOUS } = HashPurpose

export class SignatureGraph<T extends NodeBody = NodeBody> {
  root: Hash
  head: Hash
  nodes: Map<Hash, SignedNode<T>> = new Map()
  context: LocalUserContext

  constructor(payload: any = {}, context: LocalUserContext) {
    this.context = context
    // create new root node
    const rootNode = this.append({ type: 'ROOT', payload })
    this.root = rootNode.hash
  }

  get = (hash: Hash) => this.nodes.get(hash)
  getRoot = () => this.nodes.get(this.root)!
  getHead = () => this.nodes.get(this.head)!

  append = (node: PartialNodeBody<T>) => {
    // chain to previous head
    const body = {
      ...node,
      context: redactContext(this.context),
      timestamp: new Date().getTime(),
      prev: this.head ?? null, // only null if this is the root
    } as T

    const { userName, keys } = this.context.user
    const hash = hashNode(body)

    // make this node the new head
    this.head = hash

    // attach signature
    const signedNode = {
      body,
      hash,
      signed: {
        userName,
        signature: signatures.sign(body, keys.signature.secretKey),
        key: keys.signature.publicKey,
      },
    } as SignedNode<T>

    this.nodes.set(hash, signedNode)

    return signedNode
  }
}

const hashNode = (body: any) => base64.encode(hash(LINK_TO_PREVIOUS, body))
