import DOMPurify from 'dompurify'
import { Marked } from 'marked'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

// Model output is untrusted. Disable raw HTML, images and executable URL schemes
// before the separate DOMPurify pass. Formatting remains ordinary Markdown.
export function renderUntrustedMarkdown(content: string): string {
  const parser = new Marked({
    async: false, breaks: true, gfm: true,
    renderer: {
      html({ text }) { return escapeHtml(text) },
      image({ text }) { return escapeHtml(text) },
      link({ href, title, tokens }) {
        const label = this.parser.parseInline(tokens)
        try {
          const url = new URL(href, 'https://www.blizzardbot.ai/')
          if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) return label
          return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''} rel="noopener noreferrer">${label}</a>`
        } catch { return label }
      }
    }
  })
  return parser.parse(content, { async: false }) as string
}

/** The single browser HTML boundary, also exercised by the local DOM harness. */
export function sanitizeForecastMarkdown(content: string): string {
  return DOMPurify.sanitize(renderUntrustedMarkdown(content), {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'del', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['href', 'title', 'rel', 'start', 'align'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false
  })
}
