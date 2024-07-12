#! /usr/bin/env node

import figlet from 'figlet';
import inquirer from 'inquirer';
import pad from 'pad';
import { program } from '@commander-js/extra-typings';

import team from './commands/team';
import interactive from './commands/interactive';

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
