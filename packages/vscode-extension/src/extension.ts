/**
 * EOS System VS Code Extension
 * Auto-configures the MCP server and exposes EOS commands in the VS Code UI.
 * Zero external runtime dependencies — uses VS Code API only.
 */

// VS Code API (provided at runtime by the extension host)
declare const require: (module: string) => Record<string, unknown>;
const vscode = require("vscode") as typeof import("vscode");

import { execFileSync, spawn } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

let mcpServerProcess: ReturnType<typeof spawn> | null = null;
let outputChannel: import("vscode").OutputChannel;

/**
 * Resolves the EOS project root from VS Code workspace or config.
 */
function resolveEosRoot(): string | null {
  const config = vscode.workspace.getConfiguration("eos");
  const configured = config.get<string>("projectRoot");
  if (configured && fs.existsSync(path.join(configured, "package.json"))) {
    return configured;
  }
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const wsRoot = workspaceFolders[0].uri.fsPath;
    if (fs.existsSync(path.join(wsRoot, "bin", "eos.mjs"))) {
      return wsRoot;
    }
  }
  return null;
}

export function activate(context: import("vscode").ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel("EOS System");
  outputChannel.appendLine("[EOS] Extension activated.");

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("eos.consult", async () => {
      const eosRoot = resolveEosRoot();
      if (!eosRoot) {
        vscode.window.showErrorMessage("EOS: Could not find EOS project root. Set eos.projectRoot in settings.");
        return;
      }
      const problem = await vscode.window.showInputBox({
        prompt: "Describe your engineering problem",
        placeHolder: "e.g. N+1 query in TypeScript ORM users endpoint",
      });
      if (!problem) return;

      try {
        const result = execFileSync(process.execPath, ["bin/eos.mjs", "consult", problem], {
          cwd: eosRoot, encoding: "utf8", timeout: 30_000,
        });
        const doc = await vscode.workspace.openTextDocument({ content: result, language: "markdown" });
        await vscode.window.showTextDocument(doc);
        outputChannel.appendLine(`[EOS] Consulting deliverable generated for: ${problem.slice(0, 60)}`);
      } catch (err) {
        vscode.window.showErrorMessage(`EOS consult failed: ${String(err).slice(0, 100)}`);
      }
    }),

    vscode.commands.registerCommand("eos.specDrift", async () => {
      const eosRoot = resolveEosRoot();
      if (!eosRoot) return;
      try {
        const result = execFileSync(process.execPath, ["bin/eos.mjs", "spec", "drift"], {
          cwd: eosRoot, encoding: "utf8", timeout: 15_000,
        });
        outputChannel.show();
        outputChannel.appendLine("[EOS] Spec Drift Report:\n" + result);
      } catch (err) {
        vscode.window.showWarningMessage(`EOS: Spec drift detected — check EOS output channel`);
        outputChannel.show();
      }
    }),

    vscode.commands.registerCommand("eos.contextWindow", async () => {
      const editor = vscode.window.activeTextEditor;
      const eosRoot = resolveEosRoot();
      if (!editor || !eosRoot) return;

      const relPath = path.relative(eosRoot, editor.document.uri.fsPath).replace(/\\/g, "/");
      const objective = await vscode.window.showInputBox({
        prompt: `Assemble context for ${path.basename(relPath)}`,
        placeHolder: "What do you need to do with this file?",
      });
      if (!objective) return;

      try {
        const result = execFileSync(
          process.execPath,
          ["bin/eos.mjs", "context", objective, relPath],
          { cwd: eosRoot, encoding: "utf8", timeout: 20_000 }
        );
        const doc = await vscode.workspace.openTextDocument({ content: result, language: "markdown" });
        vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      } catch (err) {
        vscode.window.showErrorMessage(`EOS context window failed: ${String(err).slice(0, 100)}`);
      }
    }),

    vscode.commands.registerCommand("eos.startMcpServer", async () => {
      const eosRoot = resolveEosRoot();
      if (!eosRoot) return;

      if (mcpServerProcess) {
        vscode.window.showInformationMessage("EOS MCP server is already running.");
        return;
      }

      const config = vscode.workspace.getConfiguration("eos");
      const token  = config.get<string>("mcpToken") || "";
      const env    = { ...process.env, EOS_MCP_TOKEN: token };

      mcpServerProcess = spawn(process.execPath, ["bin/eos.mjs", "mcp", "--sse", "3333"], {
        cwd: eosRoot, env, detached: false,
      });

      mcpServerProcess.stdout?.on("data", (d: Buffer) => outputChannel.appendLine(d.toString()));
      mcpServerProcess.stderr?.on("data", (d: Buffer) => outputChannel.appendLine(d.toString()));
      mcpServerProcess.on("exit", () => { mcpServerProcess = null; });

      vscode.window.showInformationMessage("EOS MCP Server started on http://127.0.0.1:3333");
      outputChannel.appendLine("[EOS] MCP Server started on port 3333");
    }),
  );

  outputChannel.appendLine("[EOS] All commands registered. Ready.");
}

export function deactivate(): void {
  mcpServerProcess?.kill();
  mcpServerProcess = null;
  outputChannel?.appendLine("[EOS] Extension deactivated.");
}
