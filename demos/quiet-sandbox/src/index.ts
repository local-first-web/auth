#! /usr/bin/env ts-node

import { program } from '@commander-js/extra-typings';

import team from './prompts/team';
import interactive from './prompts/interactive';

program
  .command('interactive')
  .description('Interactive mode')
  .action(() => {
    interactive();
  });

program
  .command('team')
  .description('Print team information')
  .action(() => {
      team();
  });

program.parse(process.argv);
