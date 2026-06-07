import type { PhaseHandler } from './types.js'
import { extractJsonFromParts } from '../../opencode/utils.js'

export const ship: PhaseHandler = async ({ oc, sessionId, bot, pipelineState, onProgress }) => {
  await onProgress('Preparing deployment artifacts...')

  const prompt = `The bot "${bot.name}" is ready for deployment. Generate these deployment artifacts:

1. Dockerfile (multi-stage, production-optimized)
2. docker-compose.yml (with optional redis for session storage)
3. .github/workflows/deploy.yml (CI/CD to deploy)
4. Procfile (for Heroku/Railway deployment)
5. fly.toml (for Fly.io deployment)

Also read the package.json and determine:
- The bot token env var name
- Any other required env vars
- The start command

Respond with JSON:
{
  "artifact_files": string[],
  "required_env_vars": string[],
  "start_command": string,
  "docker_image_size_estimate": "small" | "medium" | "large",
  "deployment_options": string[],
  "recommended_deployment": string,
  "post_deploy_instructions": string
}`

  const result = await oc.sendPrompt(sessionId, prompt, {
    format: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          artifact_files: { type: 'array', items: { type: 'string' } },
          required_env_vars: { type: 'array', items: { type: 'string' } },
          start_command: { type: 'string' },
          docker_image_size_estimate: { type: 'string', enum: ['small', 'medium', 'large'] },
          deployment_options: { type: 'array', items: { type: 'string' } },
          recommended_deployment: { type: 'string' },
          post_deploy_instructions: { type: 'string' },
        },
        required: ['required_env_vars', 'start_command', 'recommended_deployment'],
      },
    },
  })

  const data = extractJsonFromParts(result.parts) ?? {}

  return {
    success: true,
    data: {
      ...data,
      deploymentReady: true,
      botTokenEnvVar: 'BOT_TOKEN',
    },
  }
}
