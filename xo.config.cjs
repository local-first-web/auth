const OFF = 0
const WARN = 1
const ERROR = 2
const NEVER = 'never'
const ALWAYS = 'always'

module.exports = {
  plugins: ['unused-imports'],

  // use existing prettier config
  prettier: true,

  ignore: [
    // Config files aren't worth linting, but these patterns are gitignore-style: a bare `*.js`
    // matches at any depth, which used to silently exempt every .js file in the repo — including
    // `scripts/verify-published-types.js`, the CI gate for auth-ax2. Anchor them to the root (and
    // name the one per-package config explicitly) so `scripts/` is covered.
    '/*.cjs',
    '/*.js',
    'packages/*/xo.config.cjs',
    // not bothering with the demos
    'demos/**/*',
  ],

  rules: {
    // ADDED RULES

    'unused-imports/no-unused-imports': ERROR,
    'unused-imports/no-unused-vars': [
      ERROR,
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],

    // DISABLED RULES

    '@typescript-eslint/consistent-type-assertions': OFF, // sometimes you need to assert
    '@typescript-eslint/no-empty-function': OFF, // don't see the problem
    '@typescript-eslint/no-implicit-any-catch': OFF, // deprecated
    '@typescript-eslint/padding-line-between-statements': OFF, // leave formatting to prettierjs
    'capitalized-comments': OFF, // case in point this comment
    'default-case': OFF, // not necessary with typescript
    'guard-for-in': OFF, // not necessary with typescript
    'import/no-extraneous-dependencies': OFF, // haven't figured out how to make this work with monorepo
    'n/file-extension-in-import': OFF, // duplicate of import/extensions
    'n/prefer-global/process': OFF, // use globalThis
    'no-else-return': OFF, // don't agree
    'unicorn/no-array-reduce': OFF, // sometimes I like to reduce
    'unicorn/no-negated-condition': OFF, // sometimes prefer to keep conditions in a certain order
    'unicorn/prefer-node-protocol': OFF, // false positives with /util folder
    'unicorn/prefer-spread': OFF, // don't find [...a] readable compared to a.split('')
    'unicorn/prevent-abbreviations': OFF, // gets mad about "numLikes" etc.

    // DISABLED FOR EXPEDIENCY, MIGHT REVISIT
    'max-params': OFF,
    'no-prototype-builtins': OFF,
    'import/no-unassigned-import': OFF,
    'unicorn/no-array-callback-reference': OFF,
    'unicorn/prefer-event-target': OFF,
    'no-warning-comments': OFF,
    'unicorn/filename-case': OFF,
    'unicorn/no-object-as-default-parameter': OFF,
    'unicorn/prefer-array-some': OFF,
    '@typescript-eslint/default-param-last': OFF,
    '@typescript-eslint/no-unsafe-argument': OFF,
    '@typescript-eslint/no-unsafe-assignment': OFF,
    '@typescript-eslint/no-unsafe-return': OFF,
    '@typescript-eslint/no-unsafe-call': OFF,
    '@typescript-eslint/member-ordering': OFF,
    '@typescript-eslint/no-redeclare': OFF,
    'import/order': OFF,
    'max-nested-callbacks': OFF,
    complexity: OFF,

    // MODIFIED RULES

    // require file extensions on imports
    'import/extensions': [ERROR, ALWAYS, { ignorePackages: true }],

    // default is kebabCase
    'unicorn/filename-case': [ERROR, { cases: { camelCase: true, pascalCase: true } }],

    // don't flag wallaby magic comment `//?`
    'spaced-comment': [ERROR, ALWAYS, { line: { markers: ['?'] } }],

    'ava/no-import-test-files': [ERROR, { files: ['*.test.ts'] }],
  },

  overrides: [
    {
      // The @typescript-eslint plugin is only loaded for TypeScript files, so *configuring* one of
      // its rules at the top level makes every .js file report "Definition for rule ... was not
      // found". Turning one OFF up there is harmless; switching one on has to live here.
      files: '**/*.ts',
      rules: {
        // default makes us wrap every arrow function shorthand expression with braces,
        // which spreads a single line out to 3 lines
        '@typescript-eslint/no-confusing-void-expression': [WARN, { ignoreArrowShorthand: true }],

        // default is camelCase only. We want PascalCase for React components, and UPPER_CASE for constants.
        '@typescript-eslint/naming-convention': [
          ERROR,
          {
            selector: 'variable',
            format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
            leadingUnderscore: 'allow',
          },
        ],
      },
    },
    {
      // scripts/ holds CLI entry points, not library code: they're invoked by name from
      // package.json, so their kebab-case filenames are deliberate, and exiting with a status code
      // is the whole interface.
      files: 'scripts/**/*.js',
      rules: {
        'unicorn/filename-case': OFF,
        'unicorn/no-process-exit': OFF,
      },
    },
  ],
}
