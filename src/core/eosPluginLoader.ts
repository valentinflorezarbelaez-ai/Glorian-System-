/**
 * EOS PLUGIN LOADER (Layer 0)
 * SPEC-053: External plugin loading — "everything is a plugin" architecture.
 *
 * Allows external npm packages to extend the MCP server with new tools.
 * Plugins are loaded dynamically from:
 *   1. Environment variable EOS_PLUGINS (comma-separated package names)
 *   2. A plugins.json file in the project root
 *   3. Programmatic registration via registerPlugin()
 *
 * Each plugin must export a default function that receives the ToolRegistry
 * and registers its tools:
 *
 * ```ts
 * // my-eos-plugin/index.ts
 * export default function(registry: EosToolRegistry) {
 *   registry.register({
 *     name: "my_custom_tool",
 *     description: "Does something custom",
 *     handle(args, ctx) { return { result: args.input }; }
 *   });
 * }
 * ```
 *
 * Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createLogger } from "./eosLogger.ts";

const _log = createLogger("eosPluginLoader");

/** Minimal registry surface a plugin may touch; keeps Layer 0 free of MCP types. */
export interface PluginRegistryLike {
  listTools(): readonly unknown[];
}

export interface LoadedPlugin {
  readonly name: string;
  readonly version: string;
  readonly toolsAdded: number;
  readonly loadedAt: string;
  readonly error?: string;
}

export interface PluginLoadResult {
  readonly totalPlugins: number;
  readonly successful: number;
  readonly failed: number;
  readonly plugins: readonly LoadedPlugin[];
}

/**
 * Dynamically loads and registers external plugins into the MCP tool registry.
 */
export class EosPluginLoader {
  private readonly projectRoot: string;
  private readonly loaded: LoadedPlugin[] = [];

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Discovers plugins from env vars and plugins.json.
   */
  private _discoverPlugins(): string[] {
    const plugins: string[] = [];

    // 1. From EOS_PLUGINS env var
    const envPlugins = process.env["EOS_PLUGINS"];
    if (envPlugins) {
      plugins.push(
        ...envPlugins
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
      );
    }

    // 2. From plugins.json file
    const pluginsFile = path.join(this.projectRoot, "plugins.json");
    if (fs.existsSync(pluginsFile)) {
      try {
        const config = JSON.parse(fs.readFileSync(pluginsFile, "utf8"));
        if (Array.isArray(config.plugins)) {
          plugins.push(...config.plugins.map((p: string) => p.trim()).filter(Boolean));
        }
      } catch {
        /* corrupt — skip */
      }
    }

    return [...new Set(plugins)]; // deduplicate
  }

  /**
   * Loads all discovered plugins into the given registry.
   *
   * @param registry  The EosToolRegistry instance to register tools on.
   * @param ctx       The ToolContext to pass to plugin handlers.
   * @returns PluginLoadResult with success/failure per plugin.
   */
  public async loadAll(registry: PluginRegistryLike, ctx?: unknown): Promise<PluginLoadResult> {
    const pluginNames = this._discoverPlugins();
    _log.info("Loading plugins", { count: pluginNames.length, names: pluginNames });

    for (const name of pluginNames) {
      try {
        // Try to load the plugin module
        const modulePath = this._resolvePluginPath(name);
        if (!modulePath) {
          this.loaded.push({
            name,
            version: "unknown",
            toolsAdded: 0,
            loadedAt: new Date().toISOString(),
            error: `Plugin "${name}" not found in node_modules or plugins/ directory`,
          });
          continue;
        }

        const beforeCount = registry.listTools().length;
        const mod = await import(pathToFileURL(modulePath).href);

        // Call the default export function
        if (typeof mod.default === "function") {
          mod.default(registry, ctx);
        } else if (typeof mod.register === "function") {
          mod.register(registry, ctx);
        } else {
          throw new Error(`Plugin "${name}" must export a default function or register() function`);
        }

        const afterCount = registry.listTools().length;
        const toolsAdded = afterCount - beforeCount;

        this.loaded.push({
          name,
          version: mod.version ?? "1.0.0",
          toolsAdded,
          loadedAt: new Date().toISOString(),
        });

        _log.info("Plugin loaded", { name, toolsAdded });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        this.loaded.push({
          name,
          version: "unknown",
          toolsAdded: 0,
          loadedAt: new Date().toISOString(),
          error,
        });
        _log.warn("Plugin load failed", { name, error: error.slice(0, 100) });
      }
    }

    return {
      totalPlugins: pluginNames.length,
      successful: this.loaded.filter((p) => !p.error).length,
      failed: this.loaded.filter((p) => p.error).length,
      plugins: Object.freeze(this.loaded),
    };
  }

  /**
   * Resolves a plugin name to a file path.
   * Checks: plugins/ directory → node_modules/ → absolute path.
   */
  private _resolvePluginPath(name: string): string | null {
    // 1. Local plugins/ directory
    const localPath = path.join(this.projectRoot, "plugins", `${name}.mjs`);
    if (fs.existsSync(localPath)) return localPath;

    const localPath2 = path.join(this.projectRoot, "plugins", `${name}.js`);
    if (fs.existsSync(localPath2)) return localPath2;

    // 2. node_modules (external npm package)
    const nodeModulesPath = path.join(this.projectRoot, "node_modules", name);
    if (fs.existsSync(nodeModulesPath)) {
      // Try to find the main entry point
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(nodeModulesPath, "package.json"), "utf8"));
        const main = pkg.module ?? pkg.main ?? "index.js";
        return path.join(nodeModulesPath, main);
      } catch {
        /* skip */
      }
    }

    // 3. Absolute path
    if (path.isAbsolute(name) && fs.existsSync(name)) {
      return name;
    }

    return null;
  }

  /** Returns all loaded plugins for inspection. */
  public getLoadedPlugins(): readonly LoadedPlugin[] {
    return Object.freeze(this.loaded);
  }
}
