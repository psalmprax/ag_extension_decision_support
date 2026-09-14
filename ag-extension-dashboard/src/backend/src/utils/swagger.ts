import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import { config } from '@/config';
import { logger } from '@/utils/logger';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'GPExts API Documentation',
            version: '1.0.0',
            description: 'API documentation for the GPExts Decision Support Dashboard.',
            contact: {
                name: 'API Support',
                email: 'support@ag-extension.org',
            },
        },
        servers: [
            {
                url: '/',
                description: 'Current Host (Relative Path)',
            },
            {
                url: `http://localhost:${config.port}`,
                description: 'Local development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: [
        path.join(__dirname, '../routes/*.{ts,js}'),
        path.join(__dirname, '../routes/**/*.{ts,js}'),
        path.join(__dirname, './schemas.{ts,js}'),
        path.join(__dirname, '../services/mcpAdapter.{ts,js}'),
    ], // Path to the API docs (resolves relative to current file in both dev & compiled dist)
};

let specs: object | undefined;

function getSwaggerSpecs(): object {
    if (!specs) {
        try {
            specs = swaggerJsdoc(options);
        } catch {
            specs = options.definition as object;
        }
    }
    return specs;
}

export function setupSwagger(app: Application): void {
    if (process.env.NODE_ENV === 'test') {
        return;
    }
    // API surface disclosure: the interactive docs (and the raw OpenAPI spec)
    // are for developers, not anonymous internet traffic. Allowed in dev and
    // staging; production requires an explicit opt-in AND the docs sit behind
    // the MCP token so only operators holding the secret can read them.
    const isProduction = process.env.NODE_ENV === 'production';
    const token = process.env.MCP_API_TOKEN;
    if (isProduction && (!token || process.env.SWAGGER_ENABLED_IN_PROD !== 'true')) {
        logger.info('Swagger UI disabled in production (set SWAGGER_ENABLED_IN_PROD=true to opt in)');
        return;
    }
    try {
        const swaggerSpecs = getSwaggerSpecs();
        if (isProduction && token) {
            app.use('/api-docs', (req, res, next) => {
                const provided = req.headers['x-api-token'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
                if (provided !== token) {
                    return res.status(403).json({ success: false, error: 'Forbidden' });
                }
                next();
            });
        }
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
        console.log('Swagger API documentation available at /api-docs');
    } catch (err) {
        console.warn('Swagger setup skipped:', err);
    }
}
