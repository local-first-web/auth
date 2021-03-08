const { pathsToModuleNameMapper } = require('ts-jest/utils')
const { compilerOptions } = require('./tsconfig.json')

const { paths } = compilerOptions

module.exports = {
  preset: 'ts-jest',
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
}
