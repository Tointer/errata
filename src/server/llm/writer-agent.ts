import { ToolLoopAgent, stepCountIs, type LanguageModel, type ToolSet, type ProviderOptions } from 'ai'

export function createWriterAgent(args: {
  model: LanguageModel
  tools: ToolSet
  maxSteps: number
  temperature?: number
  providerOptions?: ProviderOptions
}) {
  return new ToolLoopAgent({
    model: args.model,
    tools: args.tools,
    toolChoice: 'auto',
    stopWhen: stepCountIs(args.maxSteps),
    temperature: args.temperature,
    providerOptions: args.providerOptions,
  })
}
