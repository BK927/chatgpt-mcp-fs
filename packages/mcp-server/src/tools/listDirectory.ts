import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { validatePath } from '../security/pathValidator.js';
import type { FileInfo } from '@chatgpt-mcp-fs/shared';

export const listDirectorySchema = z.object({
  path: z.string().describe('The absolute path to the directory to list'),
  recursive: z.boolean().optional().default(false).describe('Whether to list files recursively'),
  includeHidden: z.boolean().optional().default(false).describe('Whether to include hidden files (starting with .)'),
});

export const listDirectoryTool: Tool = {
  name: 'list_directory',
  description: 'List the contents of a directory. Returns file names, types, and basic metadata.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The absolute path to the directory to list',
      },
      recursive: {
        type: 'boolean',
        default: false,
        description: 'Whether to list files recursively',
      },
      includeHidden: {
        type: 'boolean',
        default: false,
        description: 'Whether to include hidden files (starting with .)',
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

async function getFileInfo(fullPath: string, name: string): Promise<FileInfo> {
  const stats = await fs.stat(fullPath);
  return {
    name,
    path: fullPath,
    isDirectory: stats.isDirectory(),
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    createdAt: stats.birthtime.toISOString(),
  };
}

async function listDirRecursive(
  dirPath: string,
  includeHidden: boolean,
  basePath: string
): Promise<FileInfo[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const results: FileInfo[] = [];

  for (const entry of entries) {
    if (!includeHidden && entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      results.push(await getFileInfo(fullPath, relativePath + '/'));
      const subResults = await listDirRecursive(fullPath, includeHidden, basePath);
      results.push(...subResults);
    } else {
      results.push(await getFileInfo(fullPath, relativePath));
    }
  }

  return results;
}

export async function listDirectory(
  params: z.infer<typeof listDirectorySchema>,
  allowedDirs: string[]
): Promise<FileInfo[]> {
  const validatedPath = await validatePath(params.path, allowedDirs);

  // Check if it's a directory
  const stats = await fs.stat(validatedPath);
  if (!stats.isDirectory()) {
    throw new Error(`Path '${validatedPath}' is not a directory`);
  }

  if (params.recursive) {
    return await listDirRecursive(validatedPath, params.includeHidden ?? false, validatedPath);
  }

  const entries = await fs.readdir(validatedPath, { withFileTypes: true });
  const results: FileInfo[] = [];

  for (const entry of entries) {
    if (!params.includeHidden && entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(validatedPath, entry.name);
    results.push(await getFileInfo(fullPath, entry.name));
  }

  return results;
}
