import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectTools } from "./tools/project.js";
import { registerTaskTools } from "./tools/task.js";
import { registerTaskStatusTools } from "./tools/task-status.js";
import { registerPrdTools } from "./tools/prd.js";
import { registerBrainstormTools } from "./tools/brainstorm.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "taskflow",
    version: "0.2.0",
  });

  registerProjectTools(server);
  registerTaskTools(server);
  registerTaskStatusTools(server);
  registerPrdTools(server);
  registerBrainstormTools(server);

  return server;
}
