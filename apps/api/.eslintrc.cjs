module.exports = {
  root: true,
  extends: ['../../tooling/eslint-config/base.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['dist', 'node_modules', '*.config.ts', 'prisma'],
};
