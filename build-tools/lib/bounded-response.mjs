export const maximumJsonBytes = 2 * 1024 * 1024

export async function readResponseJson(response) {
  if (!response.body) throw new Error('Weather response body unavailable')
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maximumJsonBytes) throw new Error('Weather response exceeds size limit')
      chunks.push(Buffer.from(value))
    }
    return JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
