import { randomUUID } from 'node:crypto'
import { mkdir, rm, unlink, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

const allowedVideoTypes = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
} as const

export type StoredVideo = {
  storageKey: string
  originalName: string
  mimeType: string
  sizeBytes: number
}

export class VideoStorageError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413,
  ) {
    super(message)
    this.name = 'VideoStorageError'
  }
}

function getStorageDirectory(): string {
  const configured = process.env.VIDEO_UPLOAD_DIR || 'data/uploads'
  const directory = isAbsolute(configured)
    ? resolve(/*turbopackIgnore: true*/ configured)
    : resolve(/*turbopackIgnore: true*/ process.cwd(), configured)
  const publicDirectory = resolve(/*turbopackIgnore: true*/ process.cwd(), 'public')
  const pathFromPublic = relative(publicDirectory, directory)
  if (
    pathFromPublic === '' ||
    (pathFromPublic !== '..' &&
      !pathFromPublic.startsWith(`..${sep}`) &&
      !isAbsolute(pathFromPublic))
  ) {
    throw new VideoStorageError('Direktori unggahan harus berada di luar folder public.', 400)
  }
  return directory
}

function getMaximumSizeBytes(): number {
  const maximumMegabytes = Number(process.env.MAX_VIDEO_SIZE_MB ?? '500')
  if (!Number.isSafeInteger(maximumMegabytes) || maximumMegabytes < 1) {
    throw new Error('MAX_VIDEO_SIZE_MB must be a positive integer.')
  }
  return maximumMegabytes * 1024 * 1024
}

export function resolveStoredVideoPath(storageKey: string): string {
  if (!/^[0-9a-f-]+\.(mp4|webm|mov)$/.test(storageKey)) {
    throw new VideoStorageError('Kunci file video tidak valid.', 400)
  }

  const root = getStorageDirectory()
  const path = resolve(root, storageKey)
  if (!path.startsWith(`${root}${sep}`)) {
    throw new VideoStorageError('Kunci file video tidak valid.', 400)
  }
  return path
}

export async function storeVideo(file: File): Promise<StoredVideo> {
  const extension =
    allowedVideoTypes[file.type as keyof typeof allowedVideoTypes]
  if (!extension) {
    throw new VideoStorageError('Format video harus MP4, WebM, atau MOV.', 400)
  }
  if (file.size === 0) {
    throw new VideoStorageError('File video tidak boleh kosong.', 400)
  }
  if (file.size > getMaximumSizeBytes()) {
    throw new VideoStorageError('Ukuran video melebihi batas yang diizinkan.', 413)
  }

  const storageKey = `${randomUUID()}${extension}`
  const path = resolveStoredVideoPath(storageKey)
  await mkdir(getStorageDirectory(), { recursive: true })
  try {
    await writeFile(path, new Uint8Array(await file.arrayBuffer()), { flag: 'wx' })
  } catch (error) {
    await rm(path, { force: true })
    throw error
  }

  return {
    storageKey,
    originalName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  }
}

export async function deleteStoredVideo(storageKey: string): Promise<void> {
  const path = resolveStoredVideoPath(storageKey)
  try {
    await unlink(path)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return
    }
    throw error
  }
}
