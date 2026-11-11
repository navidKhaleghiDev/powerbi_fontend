/// <reference types="node" />

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import * as ts from 'typescript';

const directory = mkdtempSync(join(process.cwd(), '.assistant-test-'));
try {
  for (const name of ['core', 'core.test']) {
    const source = readFileSync(new URL(`./src/lib/assistant/${name}.ts`, import.meta.url), 'utf8');
    const result = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    });
    writeFileSync(join(directory, `${name}.js`), result.outputText);
  }
  const result = spawnSync(process.execPath, ['--test', join(directory, 'core.test.js')], {
    stdio: 'inherit',
  });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
