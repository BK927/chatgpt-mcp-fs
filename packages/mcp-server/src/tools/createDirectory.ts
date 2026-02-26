import { z } from 'zod';
import fs from 'fs/promises';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { validatePath } from '../security/pathValidator.js';

export const createDirectorySchema = z.object({
  path: z.string().describe('The absolute path of the directory to create'),
  recursive: z.boolean().optional().default(true).describe('Whether to create parent directories if they don\'t exist'),
});

export const createDirectoryTool: Tool = {
  name: 'create_directory',
  description: 'Create a new directory at the specified path. Parent directories can be created automatically.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The absolute path of the directory to create',
      },
      recursive: {
        type: 'boolean',
        default: true,
        description: 'Whether to create parent directories if they don\'t exist',
      },
    },
    required: ['path'],
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function createDirectory(
  params: z.infer<typeof createDirectorySchema>,
  allowedDirs: string[]
): Promise<string> {
  const validatedPath = await validatePath(params.path, allowedDirs);

  await fs.mkdir(validatedPath, { recursive: params.recursive });

  return `Successfully created directory: ${validatedPath}`;
}
