// Stub window.matchMedia — jsdom does not implement it, but the framework's
// useResponsive composable calls it on mount.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Stub IntersectionObserver — used by VcDataTable virtual scroll.
(globalThis as any).IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Stub ResizeObserver — used by various layout-aware components.
(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Stub defineBlade — blade components use a `defineBlade()` macro compiled by
// a Vite plugin that is not available in the test environment.
(globalThis as any).defineBlade = vi.fn();
