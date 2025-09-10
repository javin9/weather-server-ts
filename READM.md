mcp server

## cursor 配置

## stdio 方式

```json
{
  "mcpServers": {
    "weather-server": {
      "command": "npx",
      "args": ["tsx", "<your_project_path>/weather-server-ts/src/index.ts"],
      "env": {
        "API_KEY": "<your_api_key>"
      }
    }
  }
}
```

### streamenable 方式

启动 server

```bash
npm run dev
```

配置 cursor
your_api_key 是高德地图的 api key

```json
{
  "mcpServers": {
    "weather-server-streamable-http": {
      "type": "http",
      "url": "http://localhost:8003/mcp?key=<your_api_key>"
    }
  }
}
```
