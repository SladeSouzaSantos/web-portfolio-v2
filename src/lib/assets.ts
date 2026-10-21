/** Public assets retain their existing URLs after the Vite build. */
export function assetUrl(filename: string): string {
  return `${import.meta.env.BASE_URL}assets/img/${filename}`;
}
