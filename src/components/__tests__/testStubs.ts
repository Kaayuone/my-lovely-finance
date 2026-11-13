import { defineComponent, h } from 'vue';

export const ButtonStub = defineComponent({
  name: 'ButtonTestStub',
  inheritAttrs: false,
  props: {
    disabled: Boolean,
    label: String,
  },
  emits: ['click'],
  setup(props, { attrs, emit, slots }) {
    return () =>
      h(
        'button',
        {
          ...attrs,
          disabled: props.disabled,
          onClick: (event: MouseEvent) => emit('click', event),
        },
        props.label ?? slots.default?.(),
      );
  },
});

export const DialogStub = defineComponent({
  name: 'DialogTestStub',
  props: {
    header: String,
    visible: Boolean,
  },
  emits: ['update:visible'],
  setup(props, { slots }) {
    return () =>
      props.visible
        ? h('section', { 'data-testid': 'dialog' }, [h('h2', props.header), slots.default?.()])
        : null;
  },
});

export const DrawerStub = defineComponent({
  name: 'DrawerTestStub',
  props: {
    header: String,
    visible: Boolean,
  },
  emits: ['update:visible'],
  setup(props, { emit, slots }) {
    return () =>
      props.visible
        ? h('section', { 'data-testid': 'drawer' }, [
            h('h1', props.header),
            slots.container?.({
              closeCallback: () => emit('update:visible', false),
            }),
          ])
        : null;
  },
});

export const FloatLabelStub = defineComponent({
  name: 'FloatLabel',
  setup(_, { slots }) {
    return () => h('div', slots.default?.());
  },
});

export const InputTextStub = defineComponent({
  name: 'InputText',
  inheritAttrs: false,
  props: {
    id: String,
    modelValue: String,
  },
  emits: ['update:model-value'],
  setup(props, { attrs, emit }) {
    return () =>
      h('input', {
        ...attrs,
        id: props.id,
        value: props.modelValue,
        onInput: (event: Event) => {
          if (event.target instanceof HTMLInputElement) {
            emit('update:model-value', event.target.value);
          }
        },
      });
  },
});

export const SelectButtonStub = defineComponent({
  name: 'SelectButton',
  props: {
    modelValue: String,
    allowEmpty: { type: Boolean, default: true },
  },
  emits: ['update:model-value'],
  setup() {
    return () => h('div', { 'data-testid': 'select-button' });
  },
});
