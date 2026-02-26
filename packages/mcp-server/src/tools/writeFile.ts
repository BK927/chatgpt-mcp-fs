import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { validatePath } from '../security/pathValidator.js';

export const writeFileSchema = z.object({
  path: z.string().describe('The absolute path where the file should be written'),
  content: z.string().describe('The content to write to the file'),
  encoding: z.enum(['utf-8', 'base64']).optional().default('utf-8').describe('The encoding of the content'),
  createDirectories: z.boolean().optional().default(false).describe('Whether to create parent directories if they don\'t exist'),
});

export const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Write content to a file on the local filesystem. Creates the file if it doesn\'t exist, overwrites it if it does.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The absolute path where the file should be written',
      },
      content: {
        type: 'string',
        description: 'The content to write to the file',
      },
      encoding: {
        type: 'string',
        enum: ['utf-8', 'base64'],
        default: 'utf-8',
        description: 'The encoding of the content',
      },
      createDirectories: {
        type: 'boolean',
        default: false,
        description: 'Whether to create parent directories if they don\'t exist',
      },
    },
    required: ['path', 'content'],
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function writeFile(
  params: z.infer<typeof writeFileSchema>,
  allowedDirs: string[]
): Promise<string> {
  const validatedPath = await validatePath(params.path, allowedDirs);

  // Create parent directories if requested
  if (params.createDirectories) {
    const parentDir = path.dirname(validatedPath);
    await fs.mkdir(parentDir, { recursive: true });
  }

  if (params.encoding === 'base64') {
    const buffer = Buffer.from(params.content, 'base64');
    await fs.writeFile(validatedPath, buffer);
  } else {
    await fs.writeFile(validatedPath, params.content, 'utf-8');
  }

  return `Successfully wrote to ${validatedPath}`;
}
