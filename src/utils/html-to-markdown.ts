const BLOCK_TAGS = /<\/?(p|div|h[1-6]|ul|ol|li|br|blockquote|table|tr)\b[^>]*>/i;

/** Returns true when the text contains HTML block or line-break tags. */
export const looksLikeHtml = (text: string): boolean => BLOCK_TAGS.test(text);

const decodeEntities = (text: string): string =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(+code))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');

/** Convert simple (narrative) HTML to Markdown, dropping unsupported tags. */
export const htmlToMarkdown = (html: string): string => {
  let md = html
    .replace(/\r\n?/g, '\n')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, text) =>
      `\n\n${'#'.repeat(+level)} ${text.trim()}\n\n`
    )
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, items: string) => {
      let i = 0;
      return `\n\n${items.replace(
        /<li\b[^>]*>([\s\S]*?)<\/li>/gi,
        (_m: string, item: string) => `${++i}. ${item.trim()}\n`
      )}\n\n`;
    })
    .replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_, items: string) =>
      `\n\n${items.replace(
        /<li\b[^>]*>([\s\S]*?)<\/li>/gi,
        (_m: string, item: string) => `- ${item.trim()}\n`
      )}\n\n`
    )
    .replace(/<\/(p|div|blockquote|table|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');

  md = decodeEntities(md)
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return md;
};
