import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// Resolve from this module, not the working directory, for source and built entrypoints.
export function loadEnvironment(
  root = fileURLToPath(new URL('../../../', import.meta.url)),
  environment: NodeJS.ProcessEnv = process.env,
): void {
  const paths = [resolve(root, '.env')];
  if (environment.NODE_ENV !== 'production') paths.unshift(resolve(root, '.env.local'));
  // First file wins; existing shell/container variables are never overwritten.
  const values: Record<string, string> = {};
  config({ path: paths, processEnv: values });
  for (const [key, value] of Object.entries(values)) {
    if (environment[key] === undefined) environment[key] = value;
  }
}
