// The API queue service registers browser online/offline listeners on
// globalThis at construction time. Node's global object has no
// addEventListener, so provide harmless no-ops for the unit-test environment.
if (typeof globalThis.addEventListener !== 'function') {
  globalThis.addEventListener = (() => {}) as typeof globalThis.addEventListener;
}
if (typeof globalThis.removeEventListener !== 'function') {
  globalThis.removeEventListener = (() => {}) as typeof globalThis.removeEventListener;
}
