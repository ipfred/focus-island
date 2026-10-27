import DOMPurify from 'dompurify'

// Pasted rich text must not be able to restyle the app, submit forms or embed foreign documents.
const FORBID_TAGS = [
  'style', 'link', 'meta', 'base', 'form', 'button', 'textarea', 'select', 'option',
  'iframe', 'frame', 'frameset', 'object', 'embed', 'svg', 'math',
]

let hookInstalled = false

function ensureHook() {
  if (hookInstalled) return
  hookInstalled = true
  // The editor only creates checkbox inputs; any other input type comes from pasted content.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'INPUT' && (node as Element).getAttribute('type') !== 'checkbox') {
      node.parentNode?.removeChild(node)
    }
  })
}

export function sanitizeHtml(html: string): string {
  ensureHook()
  return DOMPurify.sanitize(html, { FORBID_TAGS })
}
