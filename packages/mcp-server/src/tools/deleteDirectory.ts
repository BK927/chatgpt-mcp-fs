import { z } from 'zod';
import fs from 'fs/promises';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { validatePath } from '../security/pathValidator.js';

export const deleteDirectorySchema = z.object({
  path: z.string().describe('The absolute path of the directory to delete'),
  recursive: z.boolean().optional().default(false).describe('Whether to delete contents recursively'),
});

export const deleteDirectoryTool: Tool = {
  name: 'delete_directory',
  description: 'Delete a directory from the filesystem. Use recursive option to delete non-empty directories.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The absolute path of the directory to delete',
      },
      recursive: {
        type: 'boolean',
        default: false,
        description: 'Whether to delete contents recursively',
      },
    },
    required: ['path'],
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function deleteDirectory(
  params: z.infer<typeof deleteDirectorySchema>,
  allowedDirs: string[]
): Promise<string> {
  const validatedPath = await validatePath(params.path, allowedDirs);

  // Verify it's a directory
  const stats = await fs.stat(validatedPath);
  if (!stats.isDirectory()) {
    throw new Error(`Path '${validatedPath}' is not a directory. Use delete_file instead.`);
  }

  if (params.recursive) {
    await fs.rm(validatedPath, { recursive: true, force: true });
  } else {
    try {
      await fs.rmdir(validatedPath);
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOTEMPTY') {
        throw new Error(
          `Directory '${validatedPath}' is not empty. Use recursive: true to delete it and all its contents.`
        );
      }
      throw error;
    }
  }

  return `Successfully deleted directory: ${validatedPath}`;
}
