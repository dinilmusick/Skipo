#!/usr/bin/env node

/**
 * @fileoverview Main entry point for create-skipo CLI.
 */

import { parseArgs } from 'node:util';
import { generateNextjs } from './generators/nextjs.js';
import { generateReactVite } from './generators/react-vite.js';
import { generateElectron } from './generators/electron.js';
import * as readline from 'node:readline/promises';

/**
 * Main execution function
 */
async function main() {
  const { values, positionals } = parseArgs({
    options: {
      template: {
        type: 'string',
        short: 't',
      },
      'no-git': {
        type: 'boolean',
      },
      'no-install': {
        type: 'boolean',
      },
    },
    allowPositionals: true,
  });

  let projectName = positionals[0];
  let template = values.template;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  if (!projectName) {
    projectName = await rl.question('Project name? (skipo-app): ');
    if (!projectName) {
      projectName = 'skipo-app';
    }
  }

  if (!template) {
    template = await rl.question('Template? (nextjs | react-vite | electron): ');
    if (!template) {
      template = 'nextjs';
    }
  }

  rl.close();

  console.log(`Creating project ${projectName} with template ${template}...`);

  const skipGit = values['no-git'] ?? false;
  const skipInstall = values['no-install'] ?? false;

  try {
    switch (template) {
      case 'nextjs':
        await generateNextjs(projectName, skipGit, skipInstall);
        break;
      case 'react-vite':
        await generateReactVite(projectName, skipGit, skipInstall);
        break;
      case 'electron':
        await generateElectron(projectName, skipGit, skipInstall);
        break;
      default:
        console.error(`Unknown template: ${template}`);
        process.exit(1);
    }
    console.log('Done!');
  } catch (error) {
    console.error('Failed to generate project:', error);
    process.exit(1);
  }
}

main();
