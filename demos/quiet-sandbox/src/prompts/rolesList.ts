import { select } from '@inquirer/prompts';

import { roles } from '../data/testTeamInfo.js';
import { roleView } from './role.js';

const rolesList = async () => {
  while (true) {
    const rolesList = roles.map((role) => {
      return {
        name: role.name,
        value: role.name,
      };
    });
    rolesList.push({ name: "Exit", value: "exit" });
    const answer = await select(
      {
        message: "Select a role",
        choices: rolesList,
      },
    );
    switch (answer) {
      case "exit":
        return;
      default:
        await roleView(answer);
    };

  }
}
export default rolesList;
