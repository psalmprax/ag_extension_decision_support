import winston from 'winston';
import * as util from 'util';

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
        let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        if (Object.keys(metadata).length > 0) {
            msg += ` ${util.inspect(metadata, { depth: 3 })}`;
        }
        return msg;
    })
);

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...metadata }) => {
                    let msg = `${timestamp} ${level}: ${message}`;
                    if (Object.keys(metadata).length > 0) {
                        msg += ` ${util.inspect(metadata, { depth: 3, colors: true })}`;
                    }
                    return msg;
                })
            ),
        }),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
}) as winston.Logger & { crit: (message: string, ...meta: unknown[]) => winston.Logger };

// CRIT level (paging/monitoring hook) — winston's default npm levels have no
// crit, but existing call sites (webhooks, shared-state degradation, vault
// rotation) already invoke logger.crit. Emitted at error level so the error
// file transport captures it. Paging systems should alert on `[CRIT]`.
logger.crit = (function crit(message: string, ...meta: unknown[]) {
    logger.error(`[CRIT] ${message}`, ...meta);
    return logger;
} as unknown) as typeof logger.crit;

// Create a stream for Morgan HTTP logging
export const logStream = {
    write: (message: string) => {
        logger.info(message.trim());
    },
};
