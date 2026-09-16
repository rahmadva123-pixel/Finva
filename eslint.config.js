module.exports = [
  {
    ignores: ['.next-dev/**', 'node_modules/**', 'dist/**', 'public/**', 'coverage/**'],
  },
  // TypeScript files: use parserOptions.project so type-aware rules work
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
    },
    rules: {
      // add project-specific rules here
    },
  },
  // JavaScript files: don't reference the TS project (avoids "not included in tsconfig" errors)
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // JS-specific rules
    },
  },
];
