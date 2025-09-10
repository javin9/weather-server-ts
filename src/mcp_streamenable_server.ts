// src/index.ts
import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import axios, { AxiosResponse } from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamablehttp.js";
import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// 配置常量
const HOST = "https://restapi.amap.com";

// WeatherServer 类，基于 MCP SDK
class WeatherServer {
  private server: McpServer;
  private _amap_key: string | null = null;
  private _request_context: Koa.Context | null = null;

  constructor(name: string) {
    this.server = new McpServer({ name, version: "1.0.0" });
    this.registerTools();
  }

  // 获取和设置 amap_key
  get amap_key(): string | null {
    return this._amap_key;
  }

  set amap_key(value: string | null) {
    this._amap_key = value;
  }

  // 获取和设置请求上下文
  get request_context(): Koa.Context | null {
    return this._request_context;
  }

  set request_context(ctx: Koa.Context | null) {
    this._request_context = ctx;
  }

  // 注册工具（对应 Python 的 @app.list_tools 和 @app.call_tool）
  private registerTools() {
    this.server.registerTool(
      "query_weather",
      {
        title: "Query Weather Tool",
        description: "查询天气",
        inputSchema: {
          address: z.string().min(1, "address is required").describe("需要查询的地址"),
        },
      },
      async ({ address }) => {
        return {
          content: await this.queryWeather(address),
        };
      }
    );
  }

  // 查询天气（对应 Python 的 query_weather）
  async queryWeather(address: string): Promise<TextContent[]> {
    const ctx = this.request_context;
    let api_key: string | null = null;

    // 从查询参数获取 API 密钥
    if (ctx && ctx.query) {
      api_key = ctx.query.key as string | null;
    }

    if (!api_key) {
      return [{ type: "text", text: "api key is required" }];
    }

    this.amap_key = api_key;

    try {
      // 第一步：获取地理编码
      const geoResponse: AxiosResponse = await axios.get(`${HOST}/v3/geocode/geo`, {
        params: { key: this.amap_key, address },
      });

      console.log(this.amap_key, address);
      console.log(geoResponse.data);

      if (geoResponse.status !== 200) {
        return [{ type: "text", text: `request error: ${geoResponse.status} ${JSON.stringify(geoResponse.data)}` }];
      }

      const geoData = geoResponse.data;
      if (geoData.status !== "1") {
        return [{ type: "text", text: `request error: ${geoResponse.status} ${geoData.info}` }];
      }

      const city = geoData.geocodes[0].adcode;

      // 第二步：获取天气信息
      const weatherResponse: AxiosResponse = await axios.get(`${HOST}/v3/weather/weatherInfo`, {
        params: { key: this.amap_key, city },
      });

      const weatherData = weatherResponse.data;
      if (weatherResponse.status !== 200) {
        return [{ type: "text", text: `request error: ${weatherResponse.status} ${JSON.stringify(weatherResponse.data)}` }];
      }

      if (weatherData.status !== "1") {
        return [{ type: "text", text: `request error: ${weatherResponse.status} ${weatherData.info}` }];
      }

      return [{ type: "text", text: JSON.stringify(weatherData) }];
    } catch (error) {
      throw new Error(`Failed to query weather: ${(error as Error).message}`);
    }
  }

  // 获取 MCP 服务器实例
  getServer(): McpServer {
    return this.server;
  }
}

// 创建 Koa 应用
const app = new Koa();
const router = new Router();
const weatherServer = new WeatherServer("weather-server");

// 中间件：解析 JSON 请求体
app.use(bodyParser());

// 创建 Streamable HTTP 传输
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => Math.random().toString(36).substring(2, 15),
  enableJsonResponse: true,
});

// 挂载 MCP 服务器到 Koa
router.post("/mcp", async (ctx) => {
  weatherServer.request_context = ctx; // 设置请求上下文
  ctx.respond = false;
  await transport.handleRequest(ctx.req, ctx.res, ctx.request.body);
});

router.get("/mcp", async (ctx) => {
  weatherServer.request_context = ctx; // 设置请求上下文
  ctx.respond = false;
  await transport.handleRequest(ctx.req, ctx.res);
});

// 挂载路由
app.use(router.routes()).use(router.allowedMethods());

// 启动服务器
async function main(): Promise<void> {
  const PORT = 8003; // 与 Python 的 port=8002 一致
  await new Promise<void>((resolve, reject) => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
      resolve();
    });
    server.on("error", reject);
  });

  // 连接 MCP 服务器到传输
  await weatherServer.getServer().connect(transport);

  // 优雅关闭
  process.on("SIGTERM", () => {
    console.log("SIGTERM received. Closing server...");
    transport.close();
    process.exit(0);
  });
}

// 运行
main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
