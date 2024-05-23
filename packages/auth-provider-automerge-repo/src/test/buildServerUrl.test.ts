import { describe, it, expect } from 'vitest'
import { buildServerUrl } from '../buildServerUrl.js'

describe('buildServerUrl', () => {
  it('should prepend http:// when no protocol is provided', () => {
    const { protocol, hostname } = buildServerUrl('example.com')
    expect(protocol).toBe('http:')
    expect(hostname).toBe('example.com')
  })

  it('should not prepend http:// when https protocol is provided', () => {
    const { protocol, hostname } = buildServerUrl('https://example.com')
    expect(protocol).toBe('https:')
    expect(hostname).toBe('example.com')
  })

  it('should not prepend http:// when http protocol is provided', () => {
    const { protocol, hostname } = buildServerUrl('http://example.com')
    expect(protocol).toBe('http:')
    expect(hostname).toBe('example.com')
  })

  it('should handle hosts with ports', () => {
    const { protocol, hostname, port } = buildServerUrl('example.com:8080')
    expect(protocol).toBe('http:')
    expect(hostname).toBe('example.com')
    expect(port).toBe('8080')
  })

  it('should handle localhost', () => {
    const { protocol, hostname, port } = buildServerUrl('localhost:3000')
    expect(protocol).toBe('http:')
    expect(hostname).toBe('localhost')
    expect(port).toBe('3000')
  })
})
