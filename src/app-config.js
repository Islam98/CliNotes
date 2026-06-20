export function getServerUrl() {
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  return window.location.port === '5173' ? 'http://localhost:3000' : window.location.origin;
}
