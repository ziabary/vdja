import swaggerJSDoc from 'swagger-jsdoc';
import configManager from './configManager';


export default function genSwaggerSpec(outputFilePath: string) {
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
                    url: `http://llm.targoman.ir/api/`,
                    description: 'API Server',
                },
            ],
        },
        apis: ['./src/**/*.ts'], // Make sure this path is correct and includes your route files
    };

    const swaggerSpec = swaggerJSDoc(options);
    // const dir = path.dirname(outputFilePath);
    // fs.mkdirSync(dir, { recursive: true });

    // // Write the spec to a file
    // fs.writeFileSync(outputFilePath, JSON.stringify(swaggerSpec, null, 2));

    return swaggerSpec
}