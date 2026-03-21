import { useMemo } from 'react'
import { marked } from 'marked'

// Configure marked for safe rendering
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true, // GitHub Flavored Markdown
})

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className = '' }: MarkdownProps) {
  const html = useMemo(() => {
    if (!content) return ''
    return marked.parse(content, { async: false }) as string
  }, [content])

  return (
    <div
      className={`prose prose-sm dark:prose-invert max-w-none 
        break-words [overflow-wrap:anywhere]
        prose-p:my-2 prose-p:leading-relaxed
        prose-ul:my-2 prose-ul:pl-4
        prose-ol:my-2 prose-ol:pl-4
        prose-li:my-0.5
        prose-strong:text-foreground prose-strong:font-semibold
        prose-headings:text-foreground prose-headings:font-semibold
        prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
        ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
