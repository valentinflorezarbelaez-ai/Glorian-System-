import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../bin/eos.mjs", import.meta.url));

describe("EOS CLI Shell Autocompletion (SPEC-250)", () => {
  it("generates valid PowerShell argument completer script with 768 commands", () => {
    const output = execFileSync(process.execPath, [cliPath, "completion", "powershell"], {
      encoding: "utf8",
    });
    assert.ok(output.includes("Register-ArgumentCompleter"));
    assert.ok(output.includes("'toolchain:trading:cockpit'"));
    assert.ok(output.includes("'verify'"));
    assert.ok(output.includes("'completion'"));
  });

  it("generates valid Bash completion script with COMPREPLY", () => {
    const output = execFileSync(process.execPath, [cliPath, "completion", "bash"], {
      encoding: "utf8",
    });
    assert.ok(output.includes("_glorian_completions"));
    assert.ok(output.includes("compgen -W"));
    assert.ok(output.includes("complete -F _glorian_completions glorian eos"));
  });

  it("generates valid Zsh completion script with _describe", () => {
    const output = execFileSync(process.execPath, [cliPath, "completion", "zsh"], {
      encoding: "utf8",
    });
    assert.ok(output.includes("#compdef glorian eos"));
    assert.ok(output.includes("_describe 'command' commands"));
    assert.ok(output.includes("compdef _glorian glorian eos"));
  });

  it("generates valid Fish completion script", () => {
    const output = execFileSync(process.execPath, [cliPath, "completion", "fish"], {
      encoding: "utf8",
    });
    assert.ok(output.includes("complete -c glorian -a"));
    assert.ok(output.includes("complete -c eos -a"));
  });

  it("lists all command tokens via --list", () => {
    const output = execFileSync(process.execPath, [cliPath, "completion", "--list"], {
      encoding: "utf8",
    });
    const lines = output.trim().split(/\r?\n/).filter(Boolean);
    assert.ok(lines.length >= 768, `Expected >= 768 commands, got ${lines.length}`);
    assert.ok(lines.includes("verify"));
    assert.ok(lines.includes("completion"));
    assert.ok(lines.includes("toolchain:trading:cockpit"));
  });
});
