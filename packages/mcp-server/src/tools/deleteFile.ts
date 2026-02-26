import { z } from 'zod';
import fs from 'fs/promises';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { validatePath } from '../security/pathValidator.js';

export const deleteFileSchema = z.object({
  path: z.string().describe('The absolute path of the file to delete'),
});

export const deleteFileTool: Tool = {
  name: 'delete_file',
  description: 'Delete a file from the filesystem. This operation cannot be undone.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The absolute path of the file to delete',
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

export async function deleteFile(
  params: z.infer<typeof deleteFileSchema>,
  allowedDirs: string[]
): Promise<string> {
  const validatedPath = await validatePath(params.path, allowedDirs);

  // Verify it's a file, not a directory
  const stats = await fs.stat(validatedPath);
  if (stats.isDirectory()) {
    throw new Error(`Path '${validatedPath}' is a directory. Use delete_directory instead.`);
  }

  await fs.unlink(validatedPath);

  return `Successfully deleted file: ${validatedPath}`;
}
