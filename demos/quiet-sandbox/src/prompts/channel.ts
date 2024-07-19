import chalk from 'chalk';
import inquirer from 'inquirer';
import pad from 'pad';

import { messages } from '../data/testTeamInfo.js';
import actionSelect from '../components/actionSelect.js';
import figlet from 'figlet';

const channelView = async (channelName: string): Promise<undefined> => {
  let exit = false;
  // TODO: get messages from middleware
  let messageList = messages[channelName] || [];
  while (exit === false) {
    // TODO: create a channel view interface with updateable msg display
    let max_author_length = Math.max(...messageList.map((message) => message.author.length));
    let max_content_length = Math.max(...messageList.map((message) => message.content.length)) + max_author_length + 5;
    let console_width = process.stdout.columns;
    let header_width = Math.min(console_width, max_content_length);
    console.log(chalk.bold.blueBright("-".repeat(header_width)));

    let padding = Math.floor((header_width - channelName.length) / 2);
    console.log(chalk.bold.blueBright(" ".repeat(padding) + channelName + " ".repeat(header_width - padding - channelName.length)));

    console.log(chalk.bold.blueBright("-".repeat(header_width)));
    messageList.forEach((message) => {
      console.log(`${pad(message.author + ":", max_author_length + 5)} ${message.content}`);
    });
    console.log(chalk.bold.blueBright("-".repeat(header_width)));

    const answer = await actionSelect(
      {
        message: channelName,
        choices: [
          { name: "Message", value: "message", description: "Send a message to the channel" },
          { name: "Edit", value: "edit", description: "Edit channel" },
          { name: `Leave ${channelName}`, value: "leave", description: "Leave channel" },
        ],
        actions: [
          { name: "Select", value: "select", key: "e" },
          { name: "Back", value: "back", key: "q" },
        ],
      },
    );
    switch (answer.action) {
      case "select":
      case undefined: // catches enter/return key
        switch (answer.answer) {
          case "message":
            const message = await inquirer.prompt([
              {
                type: "input",
                name: "message",
                message: `Message to ${channelName}:`,
              },
            ]);
            messages[channelName].push({ author: "You", content: message.message });
            break;
          case "edit":
            console.log(chalk.bold("Editing channel metadata not yet implemented"));
            // TODO: implement editing channel metadata interface
            break;
          case "leave":
            console.log(chalk.bold(`You have left ${channelName}`));
            // TODO: emit signal to leave channel
            exit = true;
            break;
        };
        break;
      case "back":
        exit = true;
        break;
    };
  };
};

export default channelView;
