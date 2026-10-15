import { mount } from "@vue/test-utils";
import { type Component } from "vue";
import { createI18n } from "vue-i18n";

const i18n = createI18n({
  legacy: false,
  locale: "en",
  fallbackLocale: "en",
  missing: (_locale, key) => key,
  missingWarn: false,
  fallbackWarn: false,
});

export interface MountBladeOptions {
  props?: Record<string, unknown>;
  provide?: Record<string | symbol, unknown>;
  stubs?: Record<string, boolean | Component>;
}

export async function mountBlade<T extends Component>(component: T, options: MountBladeOptions = {}) {
  const wrapper = mount(component as any, {
    global: {
      plugins: [i18n],
      provide: options.provide,
      stubs: {
        Teleport: true,
        Transition: false,
        ...options.stubs,
      },
    },
    props: options.props,
  });

  await wrapper.vm.$nextTick();
  return wrapper;
}
