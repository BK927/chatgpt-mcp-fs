import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { validatePath } from '../security/pathValidator.js';

export const moveFileSchema = z.object({
  source: z.string().describe('The absolute path of the file or directory to move'),
  destination: z.string().describe('The absolute path of the destination'),
  overwrite: z.boolean().optional().default(false).describe('Whether to overwrite existing files at destination'),
});

export const moveFileTool: Tool = {
  name: 'move_file',
  description: 'Move or rename a file or directory. The source and destination must both be within allowed directories.',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'The absolute path of the file or directory to move',
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
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
};

export async function moveFile(
  params: z.infer<typeof moveFileSchema>,
  allowedDirs: string[]
): Promise<string> {
  // Validate both source and destination
  const validatedSource = await validatePath(params.source, allowedDirs);
  const validatedDest = await validatePath(params.destination, allowedDirs);

  // Check if source exists
  const sourceStats = await fs.stat(validatedSource);

  // Check if destination exists
  let destExists = false;
  try {
    await fs.stat(validatedDest);
    destExists = true;
  } catch {
    destExists = false;
  }

  if (destExists && !params.overwrite) {
    throw new Error(`Destination '${validatedDest}' already exists. Use overwrite: true to replace it.`);
  }

  // Create parent directories if needed
  const destDir = path.dirname(validatedDest);
  await fs.mkdir(destDir, { recursive: true });

  // Perform the move
  await fs.rename(validatedSource, validatedDest);

  const type = sourceStats.isDirectory() ? 'directory' : 'file';
  return `Successfully moved ${type} from ${validatedSource} to ${validatedDest}`;
}
