import { z } from 'zod';
import fs from 'fs/promises';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { validatePath } from '../security/pathValidator.js';

export const readFileSchema = z.object({
  path: z.string().describe('The absolute path to the file to read'),
  encoding: z.enum(['utf-8', 'base64', 'binary']).optional().default('utf-8').describe('The encoding to use when reading the file'),
});

export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file from the local filesystem. Returns the file content as a string.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The absolute path to the file to read',
      },
      encoding: {
        type: 'string',
        enum: ['utf-8', 'base64', 'binary'],
        default: 'utf-8',
        description: 'The encoding to use when reading the file',
      },
    },
    required: ['path'],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function readFile(
  params: z.infer<typeof readFileSchema>,
  allowedDirs: string[]
): Promise<string> {
  const validatedPath = await validatePath(params.path, allowedDirs);

  if (params.encoding === 'base64') {
    const buffer = await fs.readFile(validatedPath);
    return buffer.toString('base64');
  } else if (params.encoding === 'binary') {
    const buffer = await fs.readFile(validatedPath);
    return `<binary file: ${buffer.length} bytes>`;
  } else {
    return await fs.readFile(validatedPath, 'utf-8');
  }
}
