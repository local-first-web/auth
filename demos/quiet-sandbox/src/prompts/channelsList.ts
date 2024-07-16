import { select } from "inquirer-select-pro";
import inquirer from "inquirer";

import actionSelect from "../components/actionSelect";
import { channels, roles } from "../data/testTeamInfo";
import channelView from "./channel";
import chalk from "chalk";

const channelsList = async () => {
  let exit = false;
  // TODO: Hook up to middleware
  let channelsList = channels.map((channel) => {
    return {
      name: channel.name,
      description: channel.description,
      value: channel.name,
    };
  });

  while (exit === false) {
    // TODO: get channels list from middleware for each loop
    if (channelsList.length === 0) {
      console.log(chalk.bold("You are not in any channels"));
      const answer = await inquirer.prompt([
        {
          type: "select",
          name: "action",
          message: "What would you like to do?",
          choices: [
            { name: "Create a channel", value: "create" },
            { name: "Return to main menu", value: "return" },
            { name: "Exit", value: "exit" },
          ],
        }]);
        switch (answer.action) {
          case "create":
            const channelMetadata = await inquirer.prompt([
              {
                type: "input",
                name: "name",
                message: "Enter the name of the channel",
              },
              {
                type: "input",
                name: "description",
                message: "Enter the description of the channel",
              }
            ]);
            const rolesList = await select({
              message: "Select roles that can access the channel",
              options: roles.map((role) => {
                return {
                  name: role.name,
                  value: role.name,
                };
              }),
              multiple: true,
            });
            const confirmation = await inquirer.prompt([
              {
                type: "confirm",
                name: "confirm",
                message: `Create channel ${channelMetadata.name} with access roles ${rolesList.join(", ")}?`,
              },
            ]);
            if (confirmation.confirm) {
              console.log(chalk.bold(`You have created ${channelMetadata.name}`));
            // TODO: Hook up to middleware
              channelsList.push({
                name: channelMetadata.name,
                description: channelMetadata.description,
                value: channelMetadata.name,
              });
            }
            else {
              break;
            }
          case "return":
            return;
          case "exit":
            process.exit();
        };
        break;
      }

    const answer = await actionSelect({
      message: "Select a channel",
      choices: channelsList,
      actions: [
        { name: "View", value: "view", key: "v" },
        { name: "Leave", value: "leave", key: "l" },
        { name: "Exit", value: "exit", key: "q" },
      ],
    });
    switch (answer.action) {
      case "view":
        await channelView(answer.answer);
        break;
      case "delete":
        console.log(chalk.bold(`You have deleted ${answer.answer}`));
        // TODO: Hook up to middleware
        channelsList = channelsList.filter((channel) => channel.name !== answer.answer);
        break;
      case "leave":
        console.log(chalk.bold(`You have left ${answer.answer}`));
        // TODO: Hook up to middleware
        channelsList = channelsList.filter((channel) => channel.name !== answer.answer);
        break;
      case "exit":
        exit = true;
        break;
    };
  };
};

export default channelsList;
