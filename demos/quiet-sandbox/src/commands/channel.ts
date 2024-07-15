import actionSelect from "../prompts/actionSelect";
import { messages, channels } from "../data/testTeamInfo";
import chalk from "chalk";
import inquirer from "inquirer";
import pad from "pad";

const channelView = async (channelName: string): Promise<undefined> => {
  let exit = false;
  console.log(chalk.bold.underline(channelName));
  let messageList = messages[channelName] || [];
  while (exit === false) {
    for (let message of messageList) {
      console.log(pad(message.author + ":", 10), message.content);
    }
    const answer = await inquirer.prompt([
      {
        type: "select",
        name: "action",
        message: "",
        choices: [
          { name: "Message", value: "message", description: "Send a message to the channel" },
          { name: "Leave", value: "leave", description: "Leave channel" },
          { name: "Return to Channels", value: "return", description: "Return to channels" },
        ],
      },
    ]);

    switch (answer.action) {
      case "message":
        const message = await inquirer.prompt([
          {
            type: "input",
            name: "message",
            message: "Enter your message",
          },
        ]);
        messages[channelName].push({ author: "You", content: message.message });
        break;
      case "leave":
        console.log(chalk.bold(`You have left ${channelName}`));
        exit = true;
        break;
      case "return":
        exit = true;
        break;
    };
  };
};

export default channelView;
