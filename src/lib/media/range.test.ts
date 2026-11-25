import { describe, expect, it } from 'vitest'
import { ByteRangeError, parseRangeHeader } from '@/lib/media/range'

describe('parseRangeHeader', () => {
  it('returns null when the client did not request a range', () => {
    expect(parseRangeHeader(null, 10)).toBeNull()
  })

  it('parses closed, open-ended, and suffix byte ranges', () => {
    expect(parseRangeHeader('bytes=2-5', 10)).toEqual({ start: 2, end: 5 })
    expect(parseRangeHeader('bytes=7-', 10)).toEqual({ start: 7, end: 9 })
    expect(parseRangeHeader('bytes=-3', 10)).toEqual({ start: 7, end: 9 })
  })

  it.each([
    'items=0-1',
    'bytes=1-2,4-5',
    'bytes=5-2',
    'bytes=10-',
    'bytes=-0',
    'bytes=0-1',
  ])('rejects malformed or unsatisfiable range %s', (header) => {
    expect(() => parseRangeHeader(header, header === 'bytes=0-1' ? 0 : 10)).toThrow(
      ByteRangeError,
    )
  })
})
