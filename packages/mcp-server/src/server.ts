import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { z } from 'zod';
import express from 'express';
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
import { SimpleOAuthProvider } from './auth.js';

export interface MCPServerOptions {
  transport?: 'stdio' | 'http' | 'sse';
  port?: number;
  issuerUrl?: string;
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
  private oauthProvider: SimpleOAuthProvider;

  constructor(options: MCPServerOptions = {}) {
    this.options = {
      transport: options.transport || 'stdio',
      port: options.port || 3000,
      issuerUrl: options.issuerUrl,
    };

    this.oauthProvider = new SimpleOAuthProvider();

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
    const app = express();
    const transports = new Map<string, SSEServerTransport>();

    // Parse JSON bodies
    app.use(express.json());

    // Add OAuth routes - use custom issuer URL if provided (for ngrok, etc.)
    const issuerUrl = this.options.issuerUrl
      ? new URL(this.options.issuerUrl)
      : new URL(`http://localhost:${port}`);

    app.use(mcpAuthRouter({
      provider: this.oauthProvider,
      issuerUrl,
      scopesSupported: ['mcp:tools'],
    }));

    // Endpoint to get pre-generated OAuth credentials (no auth required)
    app.get('/credentials', (req, res) => {
      const creds = this.oauthProvider.getPreGeneratedCredentials();
      res.json({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        issuer_url: issuerUrl.origin,
        sse_endpoint: `${issuerUrl.origin}/sse`,
      });
    });

    // SSE endpoint with bearer auth
    app.get('/sse', requireBearerAuth({
      provider: this.oauthProvider,
    }), async (req, res) => {
      const transport = new SSEServerTransport('/message', res);
      transports.set(transport.sessionId, transport);

      res.on('close', () => {
        transports.delete(transport.sessionId);
      });

      await this.server.connect(transport);
    });

    // Message endpoint with bearer auth
    app.post('/message', requireBearerAuth({
      provider: this.oauthProvider,
    }), async (req, res) => {
      const sessionId = req.query.sessionId as string;
      if (!sessionId || !transports.has(sessionId)) {
        res.status(400).json({ error: 'Invalid session' });
        return;
      }

      const transport = transports.get(sessionId)!;
      await transport.handlePostMessage(req, res);
    });

    return new Promise((resolve) => {
      this.httpServer = app.listen(port, () => {
        console.error(`MCP server started (SSE transport) on port ${port}`);
        console.error(`SSE endpoint: ${issuerUrl.origin}/sse`);
        console.error(`OAuth issuer: ${issuerUrl.origin}`);
        console.error(`Credentials endpoint: http://localhost:${port}/credentials`);
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
