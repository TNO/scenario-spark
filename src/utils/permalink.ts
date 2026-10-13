/** URL query parameter that carries a shared box. */
export const PERMALINK_PARAM = 'box';

const toBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string) => {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

const pipe = async (bytes: Uint8Array<ArrayBuffer>, stream: GenericTransformStream) =>
  new Uint8Array(
    await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()
  );

/** Compress a JSON-serialisable value into a URL-safe string. */
export const encodePermalinkData = async (value: unknown) =>
  toBase64Url(
    await pipe(
      new TextEncoder().encode(JSON.stringify(value)),
      new CompressionStream('deflate-raw')
    )
  );

/** Reverse of encodePermalinkData: returns the decompressed JSON text. */
export const decodePermalinkData = async (encoded: string) =>
  new TextDecoder().decode(
    await pipe(fromBase64Url(encoded), new DecompressionStream('deflate-raw'))
  );

/** Build a full link that opens the app and imports the given box. */
export const createPermalink = async (
  value: unknown,
  baseUrl: string,
  route: string
) => `${baseUrl}${route}?${PERMALINK_PARAM}=${await encodePermalinkData(value)}`;
