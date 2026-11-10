import { globalIgnores } from 'eslint/config';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores([
    '**/dist/**',
    '**/dist-ssr/**',
    '**/coverage/**',
    '**/android/**',
    '**/ios/**',
    '**/node_modules/**',
  ]),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  skipFormatting,

  {
    name: 'app/project-rules',
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',

      // AGENTS.md logging policy: only console.warn and console.error
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // docs/conventions/vue-components.md: script setup, type-based macros, block order
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/define-props-declaration': ['error', 'type-based'],
      'vue/define-emits-declaration': ['error', 'type-based'],
      'vue/require-explicit-emits': 'error',
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],

      // docs/conventions/vue-components.md: attribute order and the shorthand forms
      'vue/attributes-order': 'error',
      'vue/v-bind-style': ['error', 'shorthand', { sameNameShorthand: 'always' }],
      'vue/attribute-hyphenation': ['error', 'always'],
      'vue/v-on-event-hyphenation': ['error', 'always'],
      'vue/prefer-true-attribute-shorthand': 'error',
      'vue/no-unused-refs': 'error',
    },
  },

  {
    // AGENTS.md, "Приведение типов": every `as` in runtime code needs an explicit disable with a
    // reason. Tests are excluded — casting a mock to a boundary type is an accepted local pattern.
    name: 'app/no-type-assertions',
    files: ['src/**/*.{ts,vue}'],
    ignores: ['**/__tests__/**'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },

  {
    name: 'app/scripts',
    files: ['scripts/**'],
    rules: {
      // A repository script reports its result on stdout: that is its output, not a debug log
      'no-console': 'off',
    },
  },
);
