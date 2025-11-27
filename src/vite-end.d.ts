/// <reference types="vite/client" />
declare const GITHUB_RUNTIME_PERMANENT_NAME: string
declare const BASE_KV_SERVICE_URL: string

// Support for importing raw text files
declare module '*.txt?raw' {
  const content: string
  export default content
}