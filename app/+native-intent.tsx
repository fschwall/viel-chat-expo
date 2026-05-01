export function redirectSystemPath({ path }: { path: string }) {
  const normalizedPath = (path ?? '').trim();

  if (
    normalizedPath === '' ||
    normalizedPath === '/' ||
    normalizedPath === '///'
  ) {
    return '/';
  }

  return path;
}
