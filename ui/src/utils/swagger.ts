import swaggerJSDoc from 'swagger-jsdoc';


export default function genSwaggerSpec() {
    const options = {
        definition: {
            openapi: '3.0.0',
            info: {
                title: 'Targoman Services API',
                version: '1.0.0',
                description: 'API documentation Targoman Services',
            },
            servers: [
                {
                    url: `https://llm.targoman.ir/api/`,
                    description: 'API Server',
                },
            ],
        },
        apis: ['./src/**/*.ts'], // Make sure this path is correct and includes your route files
    };

    return swaggerJSDoc(options);
}