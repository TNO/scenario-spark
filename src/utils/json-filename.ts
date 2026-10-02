export const jsonFilename = (value: string): string | undefined => {
  const basename = value
    .trim()
    .replace(/\.json$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/^\.+/g, '')
    .replace(/[. ]+$/g, '');
  return basename ? `${basename}.json` : undefined;
};
