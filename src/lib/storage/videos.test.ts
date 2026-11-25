import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { describe, expect, it, afterEach, beforeEach } from 'vitest'

const storageModulePath = resolve(process.cwd(), 'src/lib/storage/videos.ts')
let temporaryRoot = ''
let publicStorageDirectory = ''

describe('local video storage', () => {
  beforeEach(async () => {
    temporaryRoot = await mkdtemp(join(tmpdir(), 'video-access-'))
    process.env.VIDEO_UPLOAD_DIR = join(temporaryRoot, 'uploads')
    process.env.MAX_VIDEO_SIZE_MB = '1'
    publicStorageDirectory = join(process.cwd(), 'public', `storage-test-${randomUUID()}`)
  })

  afterEach(async () => {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true })
    if (publicStorageDirectory) {
      await rm(publicStorageDirectory, { recursive: true, force: true })
    }
  })

  it('stores accepted video bytes under a generated private key', async () => {
    expect(existsSync(storageModulePath)).toBe(true)
    if (!existsSync(storageModulePath)) return

    const { storeVideo } = await import('./videos')
    const bytes = new Uint8Array([0, 1, 2, 3])
    const stored = await storeVideo(new File([bytes], 'clip.mp4', { type: 'video/mp4' }))

    expect(stored.storageKey).not.toContain('clip')
    expect(stored.storageKey).not.toContain('..')
    expect([
      ...(await readFile(join(process.env.VIDEO_UPLOAD_DIR!, stored.storageKey))),
    ]).toEqual([...bytes])
    expect(stored.sizeBytes).toBe(bytes.byteLength)
    expect(stored.mimeType).toBe('video/mp4')
  })

  it('rejects unsupported MIME types without writing a file', async () => {
    expect(existsSync(storageModulePath)).toBe(true)
    if (!existsSync(storageModulePath)) return

    const { storeVideo } = await import('./videos')
    await expect(
      storeVideo(new File(['not a video'], 'photo.png', { type: 'image/png' })),
    ).rejects.toThrow()

    const files = await readdir(process.env.VIDEO_UPLOAD_DIR!).catch(() => [])
    expect(files).toHaveLength(0)
  })

  it('rejects files larger than the configured maximum without writing a file', async () => {
    expect(existsSync(storageModulePath)).toBe(true)
    if (!existsSync(storageModulePath)) return

    const { storeVideo } = await import('./videos')
    const largeFile = new File(
      [new Uint8Array(1024 * 1024 + 1)],
      'large.mp4',
      { type: 'video/mp4' },
    )
    await expect(storeVideo(largeFile)).rejects.toThrow()

    const files = await readdir(process.env.VIDEO_UPLOAD_DIR!).catch(() => [])
    expect(files).toHaveLength(0)
  })

  it('refuses to store videos under the public directory', async () => {
    expect(existsSync(storageModulePath)).toBe(true)
    if (!existsSync(storageModulePath)) return

    process.env.VIDEO_UPLOAD_DIR = publicStorageDirectory
    const { storeVideo } = await import('./videos')

    await expect(
      storeVideo(new File([new Uint8Array([1])], 'private.mp4', { type: 'video/mp4' })),
    ).rejects.toThrow()
    expect(existsSync(publicStorageDirectory)).toBe(false)
  })

  it('refuses traversal keys and preserves files outside the upload directory', async () => {
    expect(existsSync(storageModulePath)).toBe(true)
    if (!existsSync(storageModulePath)) return

    const { deleteStoredVideo } = await import('./videos')
    const outsidePath = join(temporaryRoot, 'outside.mp4')
    await writeFile(outsidePath, 'keep')

    await expect(deleteStoredVideo('../outside.mp4')).rejects.toThrow()
    expect(await readFile(outsidePath, 'utf8')).toBe('keep')
  })
})
