import path from 'node:path'

export function sameFilePath(a: string, b: string): boolean {
  const left = path.resolve(a).replace(/\\/g, '/').toLowerCase()
  const right = path.resolve(b).replace(/\\/g, '/').toLowerCase()
  return left === right
}

export function pathKeyOf(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, '/').toLowerCase()
}

/** 输出路径与原素材是同一文件时拒绝写入。同目录下的不同文件名允许。 */
export function assertOutputDoesNotReplaceSource(source: string, output: string): void {
  if (sameFilePath(source, output)) {
    throw new Error(`已阻止覆盖原素材：${source}`)
  }
}
