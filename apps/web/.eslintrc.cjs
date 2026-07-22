module.exports = {
  root: true,
  extends: [
    '../../tooling/eslint-config/base.js',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
  },
  ignorePatterns: ['dist', 'node_modules', '*.config.js', '*.config.ts'],
};
