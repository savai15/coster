import { Command } from 'commander';
import { runMcpServer } from '../../mcp/server.js';

export function mcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start the Coster MCP server (stdio transport) for AI coding assistants')
    .option('-p, --project <path>', 'Project path to serve (defaults to current directory)')
    .action(async (options) => {
      try {
        await runMcpServer(options.project || process.cwd());
      } catch (error) {
        console.error('Failed to start MCP server:', error);
        process.exitCode = 1;
      }
    });
}
