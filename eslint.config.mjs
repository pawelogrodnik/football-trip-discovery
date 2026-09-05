import mantine from 'eslint-config-mantine';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// @ts-check
export default defineConfig(
  tseslint.configs.recommended,
  ...mantine,
  { ignores: ['**/*.{cjs,d.ts,d.mts}', '.next'] },
  {
    files: ['**/*.story.tsx'],
    rules: { 'no-console': 'off' },
  },
  {
    // Type-aware linting only applies to TypeScript files so standalone JS utilities
    // such as scripts/fixtures-sync/index.js don't have to be listed in tsconfig.json.
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: process.cwd(),
        project: ['./tsconfig.json'],
      },
    },
  },
  {
    // Standalone Node scripts: no project type information; allow the
    // default project so the parser does not hunt for a tsconfig.
    // These run as plain CommonJS CLIs (package has no "type": "module"),
    // so require() imports are necessary here.
    files: [
      'eslint.config.mjs',
      'scripts/fixtures-sync/*.js',
      'scripts/fixtures-sync/__tests__/*.js',
    ],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: process.cwd(),
        projectService: {
          allowDefaultProject: [
            'eslint.config.mjs',
            'scripts/fixtures-sync/*.js',
            'scripts/fixtures-sync/__tests__/*.js',
          ],
        },
        project: null,
      },
    },
  }
);
