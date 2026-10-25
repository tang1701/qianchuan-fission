import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/mp4',
  '.avi': 'video/x-msvideo',
}

export function eautoUrlToPath(requestUrl: string): string {
  const raw = requestUrl.replace(/^eauto:\/\/local\//i, '')
  let filePath = decodeURIComponent(raw)
  if (/^\/[a-zA-Z]:[/\\]/.test(filePath)) filePath = filePath.slice(1)
  return path.normalize(filePath.replace(/\//g, path.sep))
}

/** 支持 Range，供 Chromium 播放本地 MP4/MOV 预览 */
export async function serveEautoLocalFile(request: Request): Promise<Response> {
  try {
    const filePath = eautoUrlToPath(request.url)
    const st = await fs.stat(filePath)
    if (!st.isFile() || st.size <= 0) return new Response(null, { status: 404 })

    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME[ext] || 'application/octet-stream'
    const size = st.size
    const baseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    }

    const range = request.headers.get('range')
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim())
      if (match) {
        let start = match[1] ? Number.parseInt(match[1], 10) : 0
        let end = match[2] ? Number.parseInt(match[2], 10) : size - 1
        if (!Number.isFinite(start) || start < 0) start = 0
        if (!Number.isFinite(end) || end >= size) end = size - 1
        if (start > end || start >= size) {
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${size}` },
          })
        }
        const len = end - start + 1
        const body = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream
        return new Response(body, {
          status: 206,
          headers: {
            ...baseHeaders,
            'Content-Length': String(len),
            'Content-Range': `bytes ${start}-${end}/${size}`,
          },
        })
      }
    }

    const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream
    return new Response(body, {
      status: 200,
      headers: { ...baseHeaders, 'Content-Length': String(size) },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}

export async function checkMediaPreviewPath(filePath: string): Promise<{ ok: boolean; reason?: string }> {
  if (!filePath?.trim()) return { ok: false, reason: '无本地路径' }
  try {
    const st = await fs.stat(filePath)
    if (!st.isFile()) return { ok: false, reason: '文件不存在或已被移动' }
    if (st.size <= 0) return { ok: false, reason: '文件大小为 0' }
    const ext = path.extname(filePath).toLowerCase()
    if (!MIME[ext] && !['.mp4', '.mov', '.mkv', '.webm', '.m4v', '.avi'].includes(ext)) {
      return { ok: false, reason: '不支持的视频格式' }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: '找不到文件，请重新导入' }
  }
}
