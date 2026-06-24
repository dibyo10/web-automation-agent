const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const paint = (color, text) => `${color}${text}${c.reset}`;

export const logger = {

  banner(title) {
    const line = '─'.repeat(Math.max(title.length + 4, 40));
    console.log(paint(c.cyan, `\n┌${line}┐`));
    console.log(paint(c.cyan, `│  ${c.bold}${title}${c.reset}${c.cyan}`));
    console.log(paint(c.cyan, `└${line}┘`));
  },

  info(msg) {
    console.log(`${paint(c.blue, 'ℹ')}  ${msg}`);
  },

  step(n, msg) {
    console.log(`\n${paint(c.magenta, `▶ STEP ${n}`)}  ${c.bold}${msg}${c.reset}`);
  },

  toolCall(name, args) {
    const argStr = args && Object.keys(args).length ? JSON.stringify(args) : '';
    console.log(`  ${paint(c.yellow, '🔧 tool →')} ${c.bold}${name}${c.reset} ${paint(c.gray, argStr)}`);
  },

  toolResult(name, result) {
    const short =
      typeof result === 'string' ? result : JSON.stringify(result);
    const trimmed = short.length > 300 ? short.slice(0, 300) + '…' : short;
    console.log(`  ${paint(c.green, '✓ result ←')} ${name} ${paint(c.gray, trimmed)}`);
  },

  model(msg) {
    console.log(`  ${paint(c.cyan, '🧠 model:')} ${msg}`);
  },

  success(msg) {
    console.log(`${paint(c.green, '✅')} ${c.bold}${msg}${c.reset}`);
  },

  warn(msg) {
    console.log(`${paint(c.yellow, '⚠️ ')} ${msg}`);
  },

  error(msg) {
    console.log(`${paint(c.red, '❌')} ${paint(c.red, msg)}`);
  },

  dim(msg) {
    console.log(paint(c.gray, `   ${msg}`));
  },
};

export default logger;
