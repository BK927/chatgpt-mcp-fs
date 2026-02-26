import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { validatePath } from '../security/pathValidator.js';

export const copyFileSchema = z.object({
  source: z.string().describe('The absolute path of the file to copy'),
  destination: z.string().describe('The absolute path of the destination'),
  overwrite: z.boolean().optional().default(false).describe('Whether to overwrite existing files at destination'),
});

export const copyFileTool: Tool = {
  name: 'copy_file',
  description: 'Copy a file to a new location. The source and destination must both be within allowed directories.',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'The absolute path of the file to copy',
      },
      destination: {
        type: 'string',
        description: 'The absolute path of the destination',
      },
      overwrite: {
        type: 'boolean',
        default: false,
        description: 'Whether to overwrite existing files at destination',
      },
    },
    required: ['source', 'destination'],
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function copyFile(
  params: z.infer<typeof copyFileSchema>,
  allowedDirs: string[]
): Promise<string> {
  // Validate both source and destination
  const validatedSource = await validatePath(params.source, allowedDirs);
  const validatedDest = await validatePath(params.destination, allowedDirs);

  // Check if source exists and is a file
  const sourceStats = await fs.stat(validatedSource);
  if (sourceStats.isDirectory()) {
    throw new Error(`Source '${validatedSource}' is a directory. Only files can be copied.`);
  }

  // Check if destination exists
  if (!params.overwrite) {
    try {
      await fs.stat(validatedDest);
      throw new Error(`Destination '${validatedDest}' already exists. Use overwrite: true to replace it.`);
    } catch (err: unknown) {
      if (err instanceof Error && !err.message.includes('already exists')) {
        // File doesn't exist, which is what we want
      } else {
        throw err;
      }
    }
  }

  // Create parent directories if needed
  const destDir = path.dirname(validatedDest);
  await fs.mkdir(destDir, { recursive: true });

  // Perform the copy
  await fs.copyFile(validatedSource, validatedDest);

  return `Successfully copied file from ${validatedSource} to ${validatedDest}`;
}
