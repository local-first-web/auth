import { select } from '@inquirer/prompts';

import { roles } from '../data/testTeamInfo.js';
import { roleView } from './role.js';
import actionSelect from '../components/actionSelect.js';

const rolesList = async () => {
  while (true) {
    const rolesList = roles.map((role) => {
      return {
        name: role.name,
        value: role.name,
      };
    });
    const answer = await actionSelect(
      {
        message: "Select a role",
        choices: rolesList,
        actions: [
          { name: "Select", value: "select", key: "e" },
          { name: "Back", value: "back", key: "q" },
        ],
      },
    );
    switch (answer.action) {
      case "select":
      case undefined:
        await roleView(answer.answer);
        break;
      case "back":
        return;
    };

  }
}
export default rolesList;
