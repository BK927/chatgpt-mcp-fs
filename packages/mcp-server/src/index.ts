#!/usr/bin/env node

import { createServer } from './server.js';
import { initConfig } from './config/index.js';

async function main(): Promise<void> {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const transportIndex = args.indexOf('--transport');
  const portIndex = args.indexOf('--port');
  const configIndex = args.indexOf('--config');

  const transport = transportIndex !== -1 ? args[transportIndex + 1] : 'stdio';
  const port = portIndex !== -1 ? parseInt(args[portIndex + 1], 10) : 3000;
  const configPath = configIndex !== -1 ? args[configIndex + 1] : undefined;

  // Initialize config
  await initConfig(configPath);

  // Create and start server
  const server = await createServer({
    transport: transport as 'stdio' | 'http' | 'sse',
    port,
  });

  await server.start();

  // Handle shutdown signals
  process.on('SIGINT', async () => {
    console.error('Shutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('Shutting down...');
    await server.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
