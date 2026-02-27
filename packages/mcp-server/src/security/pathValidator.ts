import path from 'path';
import fs from 'fs/promises';

export class PathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathValidationError';
  }
}

/**
 * Validates that a requested path is within the allowed directories.
 * Prevents path traversal attacks using .. or symlinks.
 */
export async function validatePath(
  requestedPath: string,
  allowedDirs: string[]
): Promise<string> {
  if (allowedDirs.length === 0) {
    throw new PathValidationError('No folders have been configured for access. Please add at least one folder in the application settings before using file operations.');
  }

  // Resolve to absolute path
  const resolvedPath = path.resolve(requestedPath);
  const normalizedPath = path.normalize(resolvedPath);

  // Check if path exists and resolve symlinks
  let realPath: string;
  try {
    realPath = await fs.realpath(normalizedPath);
  } catch {
    // Path doesn't exist - validate parent directory instead
    const parentDir = path.dirname(normalizedPath);
    try {
      const realParent = await fs.realpath(parentDir);
      realPath = path.join(realParent, path.basename(normalizedPath));
    } catch {
        throw new PathValidationError(`Cannot access '${requestedPath}': the parent directory does not exist. Please verify the path is correct.`);
    }
  }

  // Check against each allowed directory
  for (const allowedDir of allowedDirs) {
    const normalizedAllowed = path.resolve(allowedDir);
    let realAllowed: string;

    try {
      realAllowed = await fs.realpath(normalizedAllowed);
    } catch {
      // Allowed directory doesn't exist, skip it
      continue;
    }

    // Check if the path is within the allowed directory
    if (realPath.startsWith(realAllowed + path.sep) || realPath === realAllowed) {
      return normalizedPath;
    }
  }

  throw new PathValidationError(
    `Access denied: '${requestedPath}' is outside the allowed folders.\nAllowed folders:\n${allowedDirs.map(d => `  - ${d}`).join('\n')}\nTo access this path, add its parent folder to the allowed folders list.`
  );
}

/**
 * Synchronous version for cases where async is not possible.
 * Does not resolve symlinks.
 */
export function validatePathSync(requestedPath: string, allowedDirs: string[]): string {
  if (allowedDirs.length === 0) {
    throw new PathValidationError('No folders have been configured for access. Please add at least one folder in the application settings before using file operations.');
  }

  const resolvedPath = path.resolve(requestedPath);
  const normalizedPath = path.normalize(resolvedPath);

  const isAllowed = allowedDirs.some(allowedDir => {
    const normalizedAllowed = path.resolve(allowedDir);
    return normalizedPath.startsWith(normalizedAllowed + path.sep) || normalizedPath === normalizedAllowed;
  });

  if (!isAllowed) {
    throw new PathValidationError(
      `Access denied: '${requestedPath}' is outside the allowed folders.\nAllowed folders:\n${allowedDirs.map(d => `  - ${d}`).join('\n')}\nTo access this path, add its parent folder to the allowed folders list.`
    );
  }

  return normalizedPath;
}

/**
 * Check if a path is within allowed directories (no error thrown)
 */
export function isPathAllowed(requestedPath: string, allowedDirs: string[]): boolean {
  try {
    validatePathSync(requestedPath, allowedDirs);
    return true;
  } catch {
    return false;
  }
}
