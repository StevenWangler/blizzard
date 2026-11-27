import { Agent, run, tool, type Model } from '@openai/agents'
import { z } from 'zod'

const resultSchema = z.object({ chance: z.number().int().min(0).max(100), url: z.string().optional() })
export const typedAgent = new Agent({ name: 'compile-only-contract', outputType: resultSchema })
export const typedTool = tool({
  name: 'compile_only_tool', description: 'Never executed by typechecking',
  parameters: z.object({ enabled: z.boolean().default(false), focus: z.enum(['morning', 'overnight']).default('morning') }),
  execute: async ({ enabled, focus }) => `${enabled}:${focus}`
})
export function parseTypedOutput(raw: string): { chance: number; url?: string } {
  return typedAgent.processFinalOutput(raw)
}
export async function runTypedContract(model: Model, signal: AbortSignal): Promise<number | undefined> {
  const agent = new Agent({ name: 'compile-only-runner', model, outputType: resultSchema,
    modelSettings: { maxTokens: 6000, reasoning: { effort: 'high' } } })
  const result = await run(agent, 'compile-only fixture', { maxTurns: 4, signal })
  return result.finalOutput?.chance
}
