import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';
import { config } from '@/config';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Ag-Extension API Documentation',
            version: '1.0.0',
            description: 'API documentation for the Ag-Extension Decision Support Dashboard.',
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
    apis: ['./src/routes/*.ts', './src/utils/schemas.ts'], // Path to the API docs
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Application): void {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
    console.log('Swagger API documentation available at /api-docs');
}
