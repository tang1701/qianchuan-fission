/** Electron IPC structured clone 不接受 Vue/Pinia 的 Proxy，需转成纯 JSON 数据 */
export function cloneForIpc<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T
}
