import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { validatePath } from '../security/pathValidator.js';
import type { SearchResult } from '@chatgpt-mcp-fs/shared';

export const searchFilesSchema = z.object({
  path: z.string().describe('The absolute path of the directory to search in'),
  pattern: z.string().describe('The search pattern (supports glob patterns like *.txt)'),
  recursive: z.boolean().optional().default(true).describe('Whether to search recursively'),
  includeHidden: z.boolean().optional().default(false).describe('Whether to include hidden files'),
  maxResults: z.number().optional().default(100).describe('Maximum number of results to return'),
});

export const searchFilesTool: Tool = {
  name: 'search_files',
  description: 'Search for files matching a pattern within a directory. Supports glob patterns.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The absolute path of the directory to search in',
      },
      pattern: {
        type: 'string',
        description: 'The search pattern (supports glob patterns like *.txt)',
      },
      recursive: {
        type: 'boolean',
        default: true,
        description: 'Whether to search recursively',
      },
      includeHidden: {
        type: 'boolean',
        default: false,
        description: 'Whether to include hidden files',
      },
      maxResults: {
        type: 'number',
        default: 100,
        description: 'Maximum number of results to return',
      },
    },
    required: ['path', 'pattern'],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

// Convert glob pattern to regex
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

async function searchDir(
  dirPath: string,
  pattern: string,
  basePath: string,
  recursive: boolean,
  includeHidden: boolean,
  maxResults: number,
  results: SearchResult[]
): Promise<void> {
  if (results.length >= maxResults) {
    return;
  }

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const regex = globToRegex(pattern);

  for (const entry of entries) {
    if (results.length >= maxResults) {
      return;
    }

    if (!includeHidden && entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    // Check if name matches pattern
    if (regex.test(entry.name)) {
      results.push({
        path: fullPath,
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        matchType: 'name',
      });
    }
    // Check if path matches pattern
    else if (regex.test(relativePath)) {
      results.push({
        path: fullPath,
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        matchType: 'path',
      });
    }

    // Recurse into directories
    if (recursive && entry.isDirectory()) {
      await searchDir(fullPath, pattern, basePath, recursive, includeHidden, maxResults, results);
    }
  }
}

export async function searchFiles(
  params: z.infer<typeof searchFilesSchema>,
  allowedDirs: string[]
): Promise<SearchResult[]> {
  const validatedPath = await validatePath(params.path, allowedDirs);

  // Check if it's a directory
  const stats = await fs.stat(validatedPath);
  if (!stats.isDirectory()) {
    throw new Error(`Path '${validatedPath}' is not a directory`);
  }

  const results: SearchResult[] = [];
  await searchDir(
    validatedPath,
    params.pattern,
    validatedPath,
    params.recursive ?? true,
    params.includeHidden ?? false,
    params.maxResults ?? 100,
    results
  );

  return results;
}
