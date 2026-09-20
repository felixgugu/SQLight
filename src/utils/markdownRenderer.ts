import { marked } from 'marked';

/**
 * Sanitizes HTML string by removing dangerous scripts, objects, and event handlers.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  let sanitized = html
    // Remove script tags and their contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove iframe tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Remove object/embed tags
    .replace(/<(object|embed)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '')
    // Remove inline event handlers (e.g. onclick=, onerror=, onload=)
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Remove javascript: pseudo-protocol in href or src
    .replace(/(href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '$1="#"')
    // Remove data:text/html
    .replace(/(href|src)\s*=\s*(?:"data:text\/html[^"]*"|'data:text\/html[^']*')/gi, '$1="#"');

  return sanitized;
}

/**
 * Enhances rendered HTML by:
 * 1. Wrapping tables with a responsive scroll container (.ai-table-wrapper)
 * 2. Adding target="_blank" and rel="noopener noreferrer" to external links
 */
export function enhanceHtml(html: string): string {
  if (!html) return '';

  // 1. Wrap <table> with .ai-table-wrapper if not already wrapped
  let enhanced = html.replace(
    /<table>([\s\S]*?)<\/table>/gi,
    '<div class="ai-table-wrapper"><table class="ai-markdown-table">$1</table></div>'
  );

  // 2. Ensure all <a> tags open securely in new window
  enhanced = enhanced.replace(/<a\s+(?!.*?target=)([^>]+)>/gi, '<a target="_blank" rel="noopener noreferrer" $1>');

  return enhanced;
}

/**
 * Renders Markdown string to safe, styled HTML with enhanced tables and links.
 */
export function renderMarkdownToHtml(markdown?: string | null): string {
  if (!markdown || typeof markdown !== 'string' || !markdown.trim()) {
    return '';
  }

  try {
    const rawHtml = (typeof marked.parse === 'function'
      ? marked.parse(markdown.trim(), { gfm: true, breaks: true })
      : (marked as unknown as (src: string) => string)(markdown.trim())) as string;
    const sanitized = sanitizeHtml(rawHtml);
    return enhanceHtml(sanitized);
  } catch (err) {
    console.error('[markdownRenderer] Error parsing markdown:', err);
    // Fallback: safely escape HTML entities and preserve line breaks
    return markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');
  }
}
