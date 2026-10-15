/**
 * Reusable mock factories for @vc-shell/framework. Each factory returns an object matching
 * the real composable's shape, with vi.fn() spies so tests can assert on calls.
 */

import { computed, ref } from "vue";
import { vi } from "vitest";
import type { HotkeyBuilder } from "@vc-shell/framework";

/**
 * Mirrors the framework's `useAsync`: wraps the action and flips `loading` around it.
 */
export function mockUseAsync<T>(fn: (args?: T) => Promise<unknown>) {
  const loading = ref(false);
  const action = async (args?: T) => {
    loading.value = true;
    try {
      return await fn(args);
    } finally {
      loading.value = false;
    }
  };
  return { action, loading };
}

/**
 * Creates a mock that matches the UseBladeReturn interface returned by useBlade().
 */
export function createMockBlade(overrides: Record<string, unknown> = {}) {
  return {
    id: ref("test-blade-id"),
    param: ref<string | undefined>(undefined),
    activeChildParam: computed<string | undefined>(() => undefined),
    options: ref<Record<string, unknown>>({}),
    query: ref<Record<string, string> | undefined>(undefined),
    closable: computed(() => true),
    expanded: computed(() => false),
    name: computed(() => "test-blade"),
    openBlade: vi.fn(),
    closeSelf: vi.fn(),
    closeChildren: vi.fn(),
    replaceWith: vi.fn(),
    coverWith: vi.fn(),
    callParent: vi.fn(),
    exposeToChildren: vi.fn(),
    provideBladeData: vi.fn(),
    onBeforeClose: vi.fn(),
    onActivated: vi.fn(),
    onDeactivated: vi.fn(),
    setError: vi.fn(),
    clearError: vi.fn(),
    addBanner: vi.fn(),
    removeBanner: vi.fn(),
    clearBanners: vi.fn(),
    ...overrides,
  };
}

const HOTKEY_MODIFIERS = ["mod", "ctrl", "meta", "alt", "shift"];

function createHotkeyBuilder(modifiers: Record<string, boolean>): HotkeyBuilder {
  return new Proxy({} as HotkeyBuilder, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      if (HOTKEY_MODIFIERS.includes(prop)) {
        return createHotkeyBuilder({ ...modifiers, [prop]: true });
      }
      return { key: prop, ...modifiers };
    },
  });
}

/**
 * Mirrors the framework's fluent `hotkey` builder: `mockHotkey.mod.s` resolves to
 * `{ key: "s", mod: true }`.
 */
export const mockHotkey: HotkeyBuilder = createHotkeyBuilder({});
