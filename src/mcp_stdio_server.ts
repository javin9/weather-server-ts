import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";

const API_HOST = "https://restapi.amap.com";

async function main() {
  // Create an MCP server
  const server = new McpServer({
    name: "weather-server tools",
    version: "1.0.0",
  });

  // Add an addition tool
  server.registerTool(
    "query_weather",
    {
      title: "Query Weather Tool",
      description: "Query the weather for a given location",
      inputSchema: { address: z.string() },
    },
    async ({ address }) => {
      // log日志不会再控制台显示，error可以
      // 获取环境变量
      const key = process.env.API_KEY;
      console.error("address", address, key);
      const response = await axios.get(`${API_HOST}/v3/geocode/geo`, {
        params: {
          key,
          address,
        },
      });

      const responseData = response.data;
      if (responseData.status === "1") {
        const city = responseData.geocodes[0].city;
        const weatherResponse = await axios.get(`${API_HOST}/v3/weather/weatherInfo`, {
          params: {
            key,
            city,
          },
        });
        const weatherData = weatherResponse.data;
        if (weatherData.status === "1") {
          const weatherInfo = weatherData.lives[0];
          return {
            content: [{ type: "text", text: JSON.stringify(weatherInfo) }],
          };
        }
      }
      return {
        content: [{ type: "text", text: String(address) }],
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// 必须 封装一个函数 然后调用
main();
