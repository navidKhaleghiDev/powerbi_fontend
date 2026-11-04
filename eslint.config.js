/// <reference types="node" />

import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import react from '@eslint-react/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import globals from 'globals';
import { configs as tsConfigs } from 'typescript-eslint';

const rootDirectory = fileURLToPath(new URL('.', import.meta.url));

// One shared ruleset for application code and tool configuration files.
export default defineConfig([
  globalIgnores([
    'dist/**',
    'node_modules/**',
    '.husky/_/**',
    '.data/**',
    '**/*.tsbuildinfo',
    // Preserve the extracted shared skeleton without editing or autofixing it.
    'src/ui/components/molecules/Loading/LoadingSkeleton.tsx',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    extends: [
      js.configs.recommended,
      tsConfigs.recommendedTypeChecked,
      importX.flatConfigs.recommended,
      importX.flatConfigs.typescript,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite(),
      // Prettier owns formatting, including Tailwind class ordering.
      prettier,
    ],
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { '@eslint-react': react },
    languageOptions: {
      // This scope contains both browser components and Node-based tooling.
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        tsconfigRootDir: rootDirectory,
        projectService: {
          // Root JavaScript config files are outside the app's tsconfig include list.
          allowDefaultProject: ['*.js', '*.mjs', '*.cjs'],
        },
      },
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: `${rootDirectory}/tsconfig.json`,
          alwaysTryTypes: true,
        }),
      ],
    },
    rules: {
      'array-callback-return': ['error', { checkForEach: true }],
      'block-scoped-var': 'error',
      'default-case-last': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'guard-for-in': 'error',
      'no-alert': 'error',
      'no-caller': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-constructor-return': 'error',
      'no-eval': 'error',
      'no-extend-native': 'error',
      'no-iterator': 'error',
      'no-labels': 'error',
      'no-lone-blocks': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-param-reassign': ['error', { props: true }],
      'no-proto': 'error',
      'no-return-assign': ['error', 'always'],
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-template-curly-in-string': 'error',
      'no-unneeded-ternary': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-arrow-callback': 'error',
      'prefer-const': 'error',
      'prefer-object-spread': 'error',
      'prefer-promise-reject-errors': 'error',
      'prefer-template': 'error',
      radix: 'error',
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/no-absolute-path': 'error',
      'import-x/no-cycle': ['error', { ignoreExternal: true }],
      'import-x/no-duplicates': ['error', { 'prefer-inline': true }],
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: ['**/*.config.{js,mjs,cjs,ts,mts}'],
          optionalDependencies: false,
          packageDir: rootDirectory,
        },
      ],
      'import-x/no-named-as-default': 'error',
      'import-x/no-named-as-default-member': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-useless-path-segments': ['error', { noUselessIndex: true }],
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
          pathGroups: [
            { pattern: '@/**', group: 'internal' },
            { pattern: '@ui/**', group: 'internal' },
            { pattern: '@uiShare/**', group: 'internal' },
          ],
          pathGroupsExcludedImportTypes: ['builtin', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@eslint-react/no-array-index-key': 'error',
      '@eslint-react/no-direct-mutation-state': 'error',
      '@eslint-react/no-duplicate-key': 'error',
      '@eslint-react/no-missing-key': 'error',
      '@eslint-react/no-nested-component-definitions': 'error',
      '@eslint-react/no-nested-lazy-component-declarations': 'error',
      '@eslint-react/no-leaked-conditional-rendering': 'error',
      '@eslint-react/jsx-no-children-prop-with-children': 'error',
      '@eslint-react/jsx-no-key-after-spread': 'error',
      '@eslint-react/dom-no-dangerously-set-innerhtml': 'error',
      '@eslint-react/dom-no-missing-button-type': 'error',
      '@eslint-react/dom-no-script-url': 'error',
      '@eslint-react/dom-no-unsafe-target-blank': 'error',
      '@eslint-react/dom-no-void-elements-with-children': 'error',
      '@eslint-react/web-api-no-leaked-event-listener': 'error',
      '@eslint-react/web-api-no-leaked-interval': 'error',
      '@eslint-react/web-api-no-leaked-resize-observer': 'error',
      '@eslint-react/web-api-no-leaked-timeout': 'error',
      'react-refresh/only-export-components': [
        'error',
        {
          allowConstantExport: true,
          allowExportNames: ['buttonVariants', 'badgeVariants', 'buttonClass', 'secondaryClass'],
        },
      ],
    },
  },
]);
