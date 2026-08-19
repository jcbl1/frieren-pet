import { debug, error, info, trace, warn } from '@tauri-apps/plugin-log'

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'
type LogContext = Record<string, unknown> | unknown

function isTauri() {
  return '__TAURI_INTERNALS__' in window
}

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }

  if (Array.isArray(value)) {
    return value.map(serialize)
  }

  if (value != null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]))
  }

  return value
}

function format(scope: string, message: string, context?: LogContext) {
  if (context === undefined) return `[${scope}] ${message}`

  try {
    return `[${scope}] ${message} ${JSON.stringify(serialize(context))}`
  } catch {
    return `[${scope}] ${message} [unserializable context]`
  }
}

const writers = { trace, debug, info, warn, error }

function write(level: LogLevel, scope: string, message: string, context?: LogContext) {
  const line = format(scope, message, context)

  if (!isTauri()) {
    console[level](line)
    return
  }

  void writers[level](line).catch(() => {
    console[level](line)
  })
}

export function createLogger(scope: string) {
  return {
    trace: (message: string, context?: LogContext) => write('trace', scope, message, context),
    debug: (message: string, context?: LogContext) => write('debug', scope, message, context),
    info: (message: string, context?: LogContext) => write('info', scope, message, context),
    warn: (message: string, context?: LogContext) => write('warn', scope, message, context),
    error: (message: string, context?: LogContext) => write('error', scope, message, context),
  }
}

export const appLogger = createLogger('app')
