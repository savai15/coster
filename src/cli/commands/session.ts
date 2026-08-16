import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import { Storage } from '../../core/storage.js';
import { generateExports } from '../../core/export.js';
import { Session } from '../../types/index.js';
import { runCleanup } from './cleanup.js';

const SILENT = process.env.COSTER_SILENT === '1';

function printSummary(storage: Storage): void {
  const memories = storage.getAllMemories();
  if (memories.length === 0) {
    console.log('No memories captured yet.');
    return;
  }

  const grouped = memories.reduce((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`Context restored: ${memories.length} memories`);
  Object.entries(grouped).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
}

export function sessionCommand(program: Command): void {
  const session = program.command('session').description('Manage Coster sessions');

  session
    .command('start')
    .description('Start a session and inject context into tool files')
    .option('--no-sync', 'Skip regenerating tool export files')
    .option('--silent', 'Suppress output')
    .action(async (options) => {
      try {
        const projectPath = process.cwd();
        const storage = await Storage.create(projectPath);

        const newSession: Session = {
          id: uuidv4(),
          startedAt: new Date().toISOString(),
          filesChanged: [],
          decisionsMade: [],
        };
        storage.createSession(newSession);

        if (options.sync !== false) {
          const results = generateExports(storage, projectPath);
          if (!SILENT && !options.silent) {
            const written = results.filter(r => r.written);
            console.log(`Session ${newSession.id.substring(0, 8)} started.`);
            console.log(`Injected context into ${written.length} tool file(s):`);
            written.forEach(r => console.log(`  - ${r.path}`));
          }
        } else if (!SILENT && !options.silent) {
          console.log(`Session ${newSession.id.substring(0, 8)} started.`);
        }

        if (!SILENT && !options.silent) {
          printSummary(storage);
        }

        storage.close();
      } catch (error) {
        console.error('Failed to start session:', error);
        process.exitCode = 1;
      }
    });

  session
    .command('end')
    .description('End the active session and archive expired memories')
    .option('--summary <text>', 'Optional session summary')
    .option('--silent', 'Suppress output')
    .action(async (options) => {
      try {
        const projectPath = process.cwd();
        const storage = await Storage.create(projectPath);

        const active = storage.getActiveSession();
        if (!active) {
          if (!SILENT && !options.silent) console.log('No active session to end.');
          storage.close();
          return;
        }

        storage.endSession(active.id, options.summary);
        if (!SILENT && !options.silent) {
          console.log(`Session ${active.id.substring(0, 8)} ended.`);
        }

        const archived = runCleanup(storage, projectPath);
        if (!SILENT && !options.silent && archived > 0) {
          console.log(`Archived ${archived} expired memories.`);
        }

        storage.close();
      } catch (error) {
        console.error('Failed to end session:', error);
        process.exitCode = 1;
      }
    });

  session
    .command('list')
    .description('List sessions')
    .option('--active', 'Show only the active session')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const projectPath = process.cwd();
        const storage = await Storage.create(projectPath);
        const sessions = storage.getSessions();

        storage.close();

        if (options.active) {
          const active = sessions.find(s => !s.endedAt);
          if (!active) {
            if (options.json) {
              console.log('[]');
            } else if (!SILENT) {
              console.log('No active session.');
            }
            return;
          }
          if (options.json) {
            console.log(JSON.stringify([active], null, 2));
          } else {
            console.log(`Active session: ${active.id.substring(0, 8)}`);
            console.log(`  Started: ${active.startedAt}`);
            console.log(`  Files changed: ${active.filesChanged.length}`);
          }
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(sessions, null, 2));
          return;
        }

        if (sessions.length === 0) {
          if (!SILENT) console.log('No sessions found.');
          return;
        }

        console.log(`\nSessions (${sessions.length}):\n`);
        for (const s of sessions) {
          const status = s.endedAt ? 'ended' : 'ACTIVE';
          console.log(`  ${s.id.substring(0, 8)} [${status}] started ${s.startedAt.substring(0, 10)}`);
        }
      } catch (error) {
        console.error('Failed to list sessions:', error);
        process.exitCode = 1;
      }
    });
}
