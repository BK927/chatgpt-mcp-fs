import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import http from 'http';
import { getConfig, initConfig } from './config/index.js';
import { readFile, readFileSchema } from './tools/readFile.js';
import { writeFile, writeFileSchema } from './tools/writeFile.js';
import { listDirectory, listDirectorySchema } from './tools/listDirectory.js';
import { createDirectory, createDirectorySchema } from './tools/createDirectory.js';
import { deleteFile, deleteFileSchema } from './tools/deleteFile.js';
import { deleteDirectory, deleteDirectorySchema } from './tools/deleteDirectory.js';
import { moveFile, moveFileSchema } from './tools/moveFile.js';
import { copyFile, copyFileSchema } from './tools/copyFile.js';
import { searchFiles, searchFilesSchema } from './tools/searchFiles.js';

export interface MCPServerOptions {
  transport?: 'stdio' | 'http' | 'sse';
  port?: number;
}

// Define Zod shapes for MCP SDK
const readFileShape = {
  path: z.string().describe('The absolute path to the file to read'),
  encoding: z.enum(['utf-8', 'base64', 'binary']).optional().default('utf-8').describe('The encoding to use when reading the file'),
};

const writeFileShape = {
  path: z.string().describe('The absolute path where the file should be written'),
  content: z.string().describe('The content to write to the file'),
  encoding: z.enum(['utf-8', 'base64']).optional().default('utf-8').describe('The encoding of the content'),
  createDirectories: z.boolean().optional().default(false).describe('Whether to create parent directories if they don\'t exist'),
};

const listDirectoryShape = {
  path: z.string().describe('The absolute path to the directory to list'),
  recursive: z.boolean().optional().default(false).describe('Whether to list files recursively'),
  includeHidden: z.boolean().optional().default(false).describe('Whether to include hidden files (starting with .)'),
};

const createDirectoryShape = {
  path: z.string().describe('The absolute path of the directory to create'),
  recursive: z.boolean().optional().default(true).describe('Whether to create parent directories if they don\'t exist'),
};

const deleteFileShape = {
  path: z.string().describe('The absolute path of the file to delete'),
};

const deleteDirectoryShape = {
  path: z.string().describe('The absolute path of the directory to delete'),
  recursive: z.boolean().optional().default(false).describe('Whether to delete contents recursively'),
};

const moveFileShape = {
  source: z.string().describe('The absolute path of the file or directory to move'),
  destination: z.string().describe('The absolute path of the destination'),
  overwrite: z.boolean().optional().default(false).describe('Whether to overwrite existing files at destination'),
};

const copyFileShape = {
  source: z.string().describe('The absolute path of the file to copy'),
  destination: z.string().describe('The absolute path of the destination'),
  overwrite: z.boolean().optional().default(false).describe('Whether to overwrite existing files at destination'),
};

const searchFilesShape = {
  path: z.string().describe('The absolute path of the directory to search in'),
  pattern: z.string().describe('The search pattern (supports glob patterns like *.txt)'),
  recursive: z.boolean().optional().default(true).describe('Whether to search recursively'),
  includeHidden: z.boolean().optional().default(false).describe('Whether to include hidden files'),
  maxResults: z.number().optional().default(100).describe('Maximum number of results to return'),
};

export class MCPFileServer {
  private server: McpServer;
  private httpServer?: http.Server;
  private options: MCPServerOptions;

  constructor(options: MCPServerOptions = {}) {
    this.options = {
      transport: options.transport || 'stdio',
      port: options.port || 3000,
    };

    this.server = new McpServer({
      name: 'chatgpt-mcp-fs',
      version: '0.1.0',
    }, {
      capabilities: {
        tools: {},
      },
    });

    this.setupTools();
  }

  private setupTools(): void {
    const config = getConfig();

    // read_file
    this.server.tool(
      'read_file',
      'Read the contents of a file from the local filesystem. Returns the file content as a string.',
      readFileShape,
      async (params) => {
        try {
          const result = await readFile(params as z.infer<typeof readFileSchema>, config.allowedFolders);
          return { content: [{ type: 'text', text: result }] };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
        }
      }
    );

    // write_file
    this.server.tool(
      'write_file',
      'Write content to a file on the local filesystem. Creates the file if it doesn\'t exist, overwrites it if it does.',
      writeFileShape,
      async (params) => {
        try {
          const result = await writeFile(params as z.infer<typeof writeFileSchema>, config.allowedFolders);
          return { content: [{ type: 'text', text: result }] };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
        }
      }
    );

    // list_directory
    this.server.tool(
      'list_directory',
      'List the contents of a directory. Returns file names, types, and basic metadata.',
      listDirectoryShape,
      async (params) => {
        try {
          const result = await listDirectory(params as z.infer<typeof listDirectorySchema>, config.allowedFolders);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
        }
      }
    );

    // create_directory
    this.server.tool(
      'create_directory',
      'Create a new directory at the specified path. Parent directories can be created automatically.',
      createDirectoryShape,
      async (params) => {
        try {
          const result = await createDirectory(params as z.infer<typeof createDirectorySchema>, config.allowedFolders);
          return { content: [{ type: 'text', text: result }] };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
        }
      }
    );

    // delete_file
    this.server.tool(
      'delete_file',
      'Delete a file from the filesystem. This operation cannot be undone.',
      deleteFileShape,
      async (params) => {
        try {
          const result = await deleteFile(params as z.infer<typeof deleteFileSchema>, config.allowedFolders);
          return { content: [{ type: 'text', text: result }] };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
        }
      }
    );

    // delete_directory
    this.server.tool(
      'delete_directory',
      'Delete a directory from the filesystem. Use recursive option to delete non-empty directories.',
      deleteDirectoryShape,
      async (params) => {
        try {
          const result = await deleteDirectory(params as z.infer<typeof deleteDirectorySchema>, config.allowedFolders);
          return { content: [{ type: 'text', text: result }] };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
        }
      }
    );

    // move_file
    this.server.tool(
      'move_file',
      'Move or rename a file or directory. The source and destination must both be within allowed directories.',
      moveFileShape,
      async (params) => {
        try {
          const result = await moveFile(params as z.infer<typeof moveFileSchema>, config.allowedFolders);
          return { content: [{ type: 'text', text: result }] };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
        }
      }
    );

    // copy_file
    this.server.tool(
      'copy_file',
      'Copy a file to a new location. The source and destination must both be within allowed directories.',
      copyFileShape,
      async (params) => {
        try {
          const result = await copyFile(params as z.infer<typeof copyFileSchema>, config.allowedFolders);
          return { content: [{ type: 'text', text: result }] };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
        }
      }
    );

    // search_files
    this.server.tool(
      'search_files',
      'Search for files matching a pattern within a directory. Supports glob patterns.',
      searchFilesShape,
      async (params) => {
        try {
          const result = await searchFiles(params as z.infer<typeof searchFilesSchema>, config.allowedFolders);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
        }
      }
    );
  }

  async start(): Promise<void> {
    if (this.options.transport === 'stdio') {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('MCP server started (stdio transport)');
    } else if (this.options.transport === 'http') {
      await this.startHttpServer();
    } else if (this.options.transport === 'sse') {
      await this.startSseServer();
    }
  }

  private async startHttpServer(): Promise<void> {
    const port = this.options.port || 3000;

    this.httpServer = http.createServer(async (req, res) => {
      if (req.method === 'POST') {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });

        res.on('close', () => {
          transport.close();
        });

        await this.server.connect(transport);
        await transport.handleRequest(req, res);
      } else {
        res.statusCode = 405;
        res.end('Method not allowed');
      }
    });

    return new Promise((resolve) => {
      this.httpServer!.listen(port, () => {
        console.error(`MCP server started (HTTP transport) on port ${port}`);
        resolve();
      });
    });
  }

  private async startSseServer(): Promise<void> {
    const port = this.options.port || 3000;
    const transports = new Map<string, SSEServerTransport>();

    this.httpServer = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (url.pathname === '/sse' && req.method === 'GET') {
        const transport = new SSEServerTransport('/message', res);
        transports.set(transport.sessionId, transport);

        res.on('close', () => {
          transports.delete(transport.sessionId);
        });

        await this.server.connect(transport);
      } else if (url.pathname === '/message' && req.method === 'POST') {
        const sessionId = url.searchParams.get('sessionId');
        if (!sessionId || !transports.has(sessionId)) {
          res.statusCode = 400;
          res.end('Invalid session');
          return;
        }

        const transport = transports.get(sessionId)!;
        await transport.handlePostMessage(req, res);
      } else {
        res.statusCode = 404;
        res.end('Not found');
      }
    });

    return new Promise((resolve) => {
      this.httpServer!.listen(port, () => {
        console.error(`MCP server started (SSE transport) on port ${port}`);
        console.error(`SSE endpoint: http://localhost:${port}/sse`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.httpServer) {
      return new Promise((resolve, reject) => {
        this.httpServer!.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }
}

export async function createServer(options?: MCPServerOptions): Promise<MCPFileServer> {
  await initConfig();
  return new MCPFileServer(options);
}
