// Configuration ESLint : code serveur (Node) et interface Vue (navigateur).
import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'coverage/', 'client/dist/'] },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{js,vue}'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.node },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      // Interdit l'injection de HTML brut (protection XSS)
      'vue/no-v-html': 'error',
      // Choix de style : textes sur une ligne, attributs libres
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/attributes-order': 'off',
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off'
    }
  },
  {
    files: ['client/**/*.{js,vue}', 'vite.config.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  }
];
