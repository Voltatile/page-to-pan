import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.agents/**',
      '.claude/**',
      '.codex/**',
      '.cursor/**',
      '.iwsdk/**',
    ],
  },
  ...tseslint.configs.recommended,
);
