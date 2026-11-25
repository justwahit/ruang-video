export type ByteRange = {
  start: number
  end: number
}

export class ByteRangeError extends Error {
  constructor(message = 'Rentang byte tidak valid.') {
    super(message)
    this.name = 'ByteRangeError'
  }
}

export function parseRangeHeader(
  header: string | null,
  fileSize: number,
): ByteRange | null {
  if (header === null) return null
  if (!Number.isSafeInteger(fileSize) || fileSize < 0) {
    throw new ByteRangeError('Ukuran file tidak valid.')
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(header)
  if (!match || fileSize === 0) throw new ByteRangeError()

  const [, startValue, endValue] = match
  if (!startValue && !endValue) throw new ByteRangeError()

  if (!startValue) {
    const suffixLength = Number(endValue)
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      throw new ByteRangeError()
    }
    return {
      start: Math.max(fileSize - suffixLength, 0),
      end: fileSize - 1,
    }
  }

  const start = Number(startValue)
  const requestedEnd = endValue ? Number(endValue) : fileSize - 1
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start >= fileSize ||
    start > requestedEnd
  ) {
    throw new ByteRangeError()
  }

  return { start, end: Math.min(requestedEnd, fileSize - 1) }
}
