import express, { Application, Request, Response, RequestHandler } from 'express';
import { HumanMessage } from "@langchain/core/messages";
import { IterableReadableStream } from '@langchain/core/utils/stream';

interface ChatRequest {
  text: string;
}

interface AgentConfig {
  configurable: {
    thread_id: string;
  };
}

interface SuccessResponse {
  status: 'success';
  response: string;
  timestamp: string;
}

interface ErrorResponse {
  status: 'error';
  error: string;
  code: number;
  timestamp: string;
}

interface Agent {
  stream: (
    params: { messages: HumanMessage[] },
    config: AgentConfig
  ) => Promise<IterableReadableStream<any>>;
}

type ApiResponse = SuccessResponse | ErrorResponse;

function createSuccessResponse(content: string): SuccessResponse {
  return {
    status: 'success',
    response: content,
    timestamp: new Date().toISOString()
  };
}

function createErrorResponse(message: string, code: number): ErrorResponse {
  return {
    status: 'error',
    error: message,
    code,
    timestamp: new Date().toISOString()
  };
}

export async function setupExpressServer(
  agent: Agent,
  config: AgentConfig
): Promise<Application> {
  const app: Application = express();
  const port: number = 3000;

  app.use(express.json());

  const chatHandler: RequestHandler = async (
    req: Request<{}, any, ChatRequest>,
    res: Response
  ): Promise<void> => {
    try {
      const chatRequest = req.body;

      if (!chatRequest.text) {
        res.status(400).json({
          error: 'El campo "text" es requerido'
        });
        return;
      }

      const stream = await agent.stream(
        { messages: [new HumanMessage(chatRequest.text)] },
        config
      );

      let responseContent = '';
      for await (const chunk of stream) {
        if ("agent" in chunk) {
          responseContent += chunk.agent.messages[0].content + '\n';
        } else if ("tools" in chunk) {
          responseContent += chunk.tools.messages[0].content + '\n';
        }
      }

      const successResponse = createSuccessResponse(responseContent.trim());
      res.json(successResponse);

    } catch (error) {
      console.error('Error procesando la petición:', error);
      const errorResponse = createErrorResponse(
        'Error interno del servidor',
        500
      );
      res.status(500).json(errorResponse);
    }
  };

  app.post('/poke', chatHandler);
  app.listen(port, () => {
    console.log(`Servidor Express escuchando en el puerto ${port}`);
  });

  return app;
}