import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

/** jsdom gaps that the app relies on. */
if (typeof URL.createObjectURL !== 'function') {
  let counter = 0
  URL.createObjectURL = () => {
    counter += 1
    return `blob:mock/${counter}`
  }
  URL.revokeObjectURL = () => undefined
}

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}

if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
}
