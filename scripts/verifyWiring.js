import { InMemoryRunner, isFunctionTool } from '@google/adk';
import rootAgent from '../agents/automationAgent.js';
import browserTools from '../tools/browserTools.js';
import logger from '../utils/logger.js';

logger.banner('ADK wiring verification (no network)');

logger.info(`Agent name : ${rootAgent.name}`);
logger.info(`Agent model: ${rootAgent.model}`);

const required = [
  'open_browser',
  'navigate_to_url',
  'take_screenshot',
  'click_on_screen',
  'double_click',
  'send_keys',
  'scroll',
];
const names = browserTools.map((t) => t.name);
logger.info(`Tools (${names.length}): ${names.join(', ')}`);

const allFunctionTools = browserTools.every((t) => isFunctionTool(t));
const missing = required.filter((r) => !names.includes(r));

const runner = new InMemoryRunner({ agent: rootAgent, appName: 'verify' });
await runner.sessionService.createSession({ appName: 'verify', userId: 'u', sessionId: 's' });

if (!allFunctionTools) throw new Error('Some tools are not FunctionTool instances.');
if (missing.length) throw new Error(`Missing required tools: ${missing.join(', ')}`);

logger.success(
  `Wiring OK: agent, ${names.length} FunctionTools, runner, and session all construct.`,
);
