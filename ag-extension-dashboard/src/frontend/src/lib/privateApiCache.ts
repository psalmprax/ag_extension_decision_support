export async function purgePrivateApiCache(): Promise<void> {
  if (typeof caches !== 'undefined') {
    await caches.delete('api-cache');
  }
}
