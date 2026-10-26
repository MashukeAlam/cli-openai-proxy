# cli-openai-proxy

An **OpenAI-compatible REST API proxy** that wraps local CLI tools (`agy`, `codex`, `claude`) and exposes them as drop-in OpenAI API endpoints. Point any OpenAI SDK or tool at `http://localhost:3000` and it just works.

---

## What It Is

`cli-openai-proxy` sits between your OpenAI-compatible client and your locally installed AI CLI tools. It translates standard OpenAI API calls (`/v1/chat/completions`, `/v1/models`) into CLI invocations, streams the output back in OpenAI's SSE format, and returns responses in the exact shape the OpenAI SDK expects.

```
Client (OpenAI SDK / curl)
        │
        ▼
  cli-openai-proxy  (http://localhost:3000)
        │
        ├──► claude -p "..."
        ├──► agy "..."
        └──► codex "..."
```

---

## Supported Models

| Model Name(s) | CLI Tool | Notes |
|---|---|---|
| `claude`, `claude-*`, `anthropic*` | `claude` | All Claude model names route here |
| `agy`, `agy-*`, `gemini-*`, `google` | `agy` | All Gemini model names route here |
| `codex`, `codex-*`, `gpt-*`, `o1*`, `o3*`, `o4*` | `codex` | All GPT/O-series model names route here |
| *(anything else)* | *(DEFAULT_PROVIDER)* | Falls back to your configured default |

---

## Prerequisites

- **Node.js 20+** (`node --version`)
- One or more CLI tools installed and on your `PATH`:
  - [`claude`](https://github.com/anthropics/claude-cli) — Anthropic's Claude CLI
  - [`agy`](https://antigravity.dev) — Google Antigravity CLI
  - [`codex`](https://github.com/openai/codex) — OpenAI Codex CLI

---

## Installation & Quick Start

```bash
# Clone the repo
git clone https://github.com/MashukeAlam/cli-openai-proxy.git
cd cli-openai-proxy

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env as needed (PORT, DEFAULT_PROVIDER, API_KEY, etc.)

# Start development server (with hot reload)
npm run dev
```

The server starts at `http://localhost:3000` by default.

---

## Usage Examples

### List Available Models

```bash
curl http://localhost:3000/v1/models
```

### Chat Completion (Non-Streaming)

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude",
    "messages": [
      {"role": "user", "content": "Explain async/await in JavaScript in two sentences."}
    ]
  }'
```

### Chat Completion (Streaming)

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.0-flash",
    "messages": [
      {"role": "user", "content": "Write a haiku about compilers."}
    ],
    "stream": true
  }'
```

### Python — OpenAI SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="any-value",  # Required by the SDK but ignored unless API_KEY is set
)

response = client.chat.completions.create(
    model="claude",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is the capital of France?"},
    ],
)
print(response.choices[0].message.content)
```

**Streaming with Python:**

```python
stream = client.chat.completions.create(
    model="gemini-2.0-flash",
    messages=[{"role": "user", "content": "Tell me a short story."}],
    stream=True,
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

### JavaScript / Node.js — OpenAI SDK

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: "any-value",
});

const response = await client.chat.completions.create({
  model: "gpt-4o",  // Routes to codex CLI
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.choices[0].message.content);
```

**Streaming with Node.js:**

```javascript
const stream = await client.chat.completions.create({
  model: "claude",
  messages: [{ role: "user", content: "Write a poem about the sea." }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}
```

### With Authentication (API_KEY set)

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-secret-key" \
  -d '{"model": "agy", "messages": [{"role": "user", "content": "Hi!"}]}'
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the HTTP server listens on |
| `API_KEY` | *(empty)* | If set, all requests must include `Authorization: Bearer <API_KEY>` |
| `DEFAULT_PROVIDER` | `claude` | Fallback CLI (`claude`, `agy`, or `codex`) when the model name doesn't match any known prefix |
| `LOG_LEVEL` | `info` | Set to `none` to disable request logging |
| `TIMEOUT_MS` | `120000` | Maximum milliseconds to wait for a CLI response (2 minutes) |

---

## Adding New Providers

1. Create `src/providers/myprovider.ts` extending `BaseProvider`:

```typescript
import { spawn } from 'child_process';
import { Writable } from 'stream';
import { ChatMessage } from '../types/openai';
import { BaseProvider, ProviderOptions } from './base';

export class MyProvider extends BaseProvider {
  constructor(options: ProviderOptions) {
    super(options);
  }

  async complete(messages: ChatMessage[], _model: string): Promise<string> {
    const prompt = this.formatMessages(messages);
    return new Promise((resolve, reject) => {
      const proc = spawn('my-cli', ['--prompt', prompt], { shell: true });
      let output = '';
      const timer = setTimeout(() => { proc.kill(); reject(new Error('Timed out')); }, this.timeoutMs);
      proc.stdout.on('data', (c: Buffer) => { output += c.toString(); });
      proc.on('close', (code) => {
        clearTimeout(timer);
        code !== 0 ? reject(new Error(`Exited ${code}`)) : resolve(output.trim());
      });
      proc.on('error', (e) => { clearTimeout(timer); reject(e); });
    });
  }

  async stream(messages: ChatMessage[], _model: string, output: Writable): Promise<void> {
    // Similar to complete() but pipe stdout to `output` directly
  }
}
```

2. Register the model prefix in [`src/routes/chat.ts`](src/routes/chat.ts) inside `getProvider()`.

3. Add model entries in [`src/routes/models.ts`](src/routes/models.ts).

---

## Docker

### Build & Run

```bash
docker build -t cli-openai-proxy .
docker run -p 3000:3000 \
  -e DEFAULT_PROVIDER=claude \
  -e API_KEY=my-secret \
  cli-openai-proxy
```

> **Note:** The CLI tools (`claude`, `agy`, `codex`) must be available inside the container. Either install them in the Dockerfile or bind-mount their binaries.

### Docker Compose Example

```yaml
version: '3.9'
services:
  proxy:
    build: .
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      DEFAULT_PROVIDER: claude
      TIMEOUT_MS: 120000
    restart: unless-stopped
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Server info |
| `GET` | `/health` | Health check |
| `GET` | `/v1/models` | List available models |
| `POST` | `/v1/chat/completions` | Create a chat completion (streaming supported) |

---

## Build for Production

```bash
npm run build        # Compiles TypeScript → dist/
npm start            # Runs dist/index.js
```

---

## License

MIT © [MashukeAlam](https://github.com/MashukeAlam)
