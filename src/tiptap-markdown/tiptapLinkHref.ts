const ATTR_WHITESPACE =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g;
const MAX_DURABLE_LINK_HREF_LENGTH = 2048;
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

function normalizeBoundedHref(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const href = value.trim();
  if (href.length === 0 || href.length > MAX_DURABLE_LINK_HREF_LENGTH) {
    return null;
  }
  return href;
}

function parseAbsoluteHttpHref(value: unknown): URL | null {
  const href = normalizeBoundedHref(value);
  if (!href) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.username !== '' ||
    url.password !== ''
  ) {
    return null;
  }
  return url;
}

export function isReoTiptapLinkHref(value: unknown): value is string {
  const href = normalizeBoundedHref(value);
  if (!href) {
    return false;
  }

  const compactHref = href.replace(ATTR_WHITESPACE, '');
  if (compactHref.startsWith('//')) {
    return false;
  }

  if (!URL_SCHEME_PATTERN.test(compactHref)) {
    return true;
  }

  return parseAbsoluteHttpHref(href) !== null;
}

export function parseReoMarkdownExternalLinkHref(value: unknown): URL | null {
  return parseAbsoluteHttpHref(value);
}

export function isReoMarkdownExternalLinkHref(value: unknown): value is string {
  return parseReoMarkdownExternalLinkHref(value) !== null;
}
