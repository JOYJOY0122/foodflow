import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom does not lay out elements; Mantine ScrollArea observes them in real browsers.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

if (typeof window !== "undefined") {
  // MantineProvider 需要 matchMedia，jsdom 沒有提供。
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
