#!/usr/bin/env pwsh
$basedir = Split-Path $MyInvocation.MyCommand.Path -Parent
$exe = "node"
if (Test-Path "$basedir/node.exe") {
  $exe = "$basedir/node.exe"
}
& $exe --experimental-strip-types "$basedir/eos.mjs" @args
exit $LASTEXITCODE
