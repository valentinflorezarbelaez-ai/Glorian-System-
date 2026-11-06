# EOS System — Plugin Directory

This directory contains local EOS plugins loaded by `EosPluginLoader`.

## Creating a plugin

Create a `.mjs` file exporting a `default` function:

```javascript
// plugins/my-plugin.mjs
export const version = "1.0.0";

export default function register(registry) {
  registry.register({
    name: "eos_my_custom_tool",
    description: "Does something custom",
    handle(args, ctx) {
      return { result: args.input, projectRoot: ctx.projectRoot };
    }
  });
}
```

## Activating plugins

Option 1 — `plugins.json` in project root:
```json
{ "plugins": ["my-plugin"] }
```

Option 2 — Environment variable:
```bash
export EOS_PLUGINS=my-plugin,another-plugin
```

## Plugin API

Your `default(registry, ctx)` receives:
- `registry` — `EosToolRegistry` instance (call `registry.register(handler)`)
- `ctx` — optional `ToolContext` with `projectRoot` and `knowledgeStore`
