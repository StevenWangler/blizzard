import ts from 'typescript'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Extract only literal schema expressions. Never import/execute the generator or
// browser agent entrypoints, which initialize providers and read environment files.
export function projectAgentSchemas(z) {
  const schemas = []
  for (const source of ['build-tools/generate-prediction.mjs', 'src/services/agentSystem.ts', 'build-tools/lib/forecast-integrity.mjs']) {
    const filename = fileURLToPath(new URL(`../../${source}`, import.meta.url))
    const file = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const evaluate = expression => {
      const text = ts.transpileModule(`const result = ${expression.getText(file)}; result`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
      }).outputText
      return vm.runInNewContext(text, { z }, { timeout: 1000 })
    }
    function visit(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text.endsWith('Schema') && node.initializer) {
        schemas.push({ source, name: node.name.text, kind: 'output', schema: evaluate(node.initializer) })
      }
      if (ts.isCallExpression(node) && node.expression.getText(file) === 'tool' && node.arguments.length && ts.isObjectLiteralExpression(node.arguments[0])) {
        const props = node.arguments[0].properties.filter(ts.isPropertyAssignment)
        const name = props.find(prop => prop.name.getText(file) === 'name')
        const parameters = props.find(prop => prop.name.getText(file) === 'parameters')
        if (name && parameters && ts.isStringLiteral(name.initializer)) {
          schemas.push({ source, name: name.initializer.text, kind: 'tool', schema: evaluate(parameters.initializer) })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
  }
  return schemas
}

export function fixtureForSchema(schema) {
  const def = schema._def
  const type = String(def.typeName || def.type).replace(/^Zod/, '').toLowerCase()
  if (type === 'object') return Object.fromEntries(Object.entries(schema.shape).map(([key, value]) => [key, fixtureForSchema(value)]).filter(([, value]) => value !== undefined))
  if (type === 'array') return Array.from({ length: 3 }, () => fixtureForSchema(def.typeName ? def.type : def.element))
  if (type === 'enum') return schema.options[0]
  if (type === 'string') return 'Synthetic offline fixture'
  if (type === 'number') {
    const minimum = Number.isFinite(schema.minValue) ? schema.minValue : 0
    const maximum = Number.isFinite(schema.maxValue) ? schema.maxValue : minimum + 10
    return Math.ceil((minimum + maximum) / 2)
  }
  if (type === 'boolean') return false
  if (type === 'optional') return undefined
  if (type === 'nullable') return null
  if (type === 'default') return schema.parse(undefined)
  throw new Error(`Fixture generator does not support ${type}; review the schema change`)
}
