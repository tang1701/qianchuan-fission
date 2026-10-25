import fs from 'node:fs/promises'
import path from 'node:path'
import { emptyLibrary, migrateLibrary, type LibraryFile } from './domain'

async function atomicWrite(file: string, text: string) {
  const tmp = `${file}.${process.pid}.tmp`
  await fs.writeFile(tmp, text, 'utf8')
  try {
    await fs.rename(tmp, file)
  } catch {
    await fs.rm(file, { force: true })
    await fs.rename(tmp, file)
  }
}

export async function loadLibrary(file: string): Promise<LibraryFile> {
  let text: string
  try {
    text = await fs.readFile(file, 'utf8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return emptyLibrary()
    throw new Error('素材库无法读取，已保留原文件，没有覆盖素材')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error('素材库无法读取，已保留原文件，没有覆盖素材')
  }
  return migrateLibrary(parsed)
}

export async function saveLibrary(file: string, data: LibraryFile): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const next: LibraryFile = {
    ...data,
    audits: data.audits.slice(-400),
    tasks: data.tasks.slice(-120),
  }
  await atomicWrite(file, JSON.stringify(next))
}
