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
    // not bothering with config files & scripts for now
    '*.cjs',
    '*.js',
    // or with the demo
    'demo/**/*',
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

    'guard-for-in': OFF, // not necessary with typescript
    '@typescript-eslint/no-empty-function': OFF, // don't see the problem
    '@typescript-eslint/no-implicit-any-catch': OFF, // deprecated
    '@typescript-eslint/consistent-type-assertions': OFF, // sometimes you need to assert
    'capitalized-comments': OFF, // case in point this comment
    'n/file-extension-in-import': OFF, // duplicate of import/extensions
    'unicorn/no-array-reduce': OFF, // sometimes I like to reduce
    'unicorn/prevent-abbreviations': OFF, // gets mad about "numLikes" etc.
    'import/no-extraneous-dependencies': OFF, // haven't figured out how to make this work with monorepo
    'unicorn/prefer-spread': OFF, // don't find [...a] readable compared to a.split('')
    'default-case': OFF, // not necessary with typescript
    'unicorn/prefer-node-protocol': OFF, // false positives with /util folder
    'no-else-return': OFF, // don't agree
    '@typescript-eslint/padding-line-between-statements': OFF, // leave formatting to prettierjs

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

    // require file extensions on imports
    'import/extensions': [ERROR, ALWAYS, { ignorePackages: true }],

    // default is kebabCase
    'unicorn/filename-case': [ERROR, { cases: { camelCase: true, pascalCase: true } }],
  },

  overrides: [],
}
