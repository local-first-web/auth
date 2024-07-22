import { roles } from '../data/testTeamInfo.js';
import { select } from 'inquirer-select-pro';

const roleSelect = async (user: string) => {
  // TODO: get current roles from middleware
  const rolesList = await select({
    message: `Select roles for ${user}`,
    options: roles.map((role) => {
      return {
        name: role.name,
        value: role.name,
      };
    }),
    multiple: true,
  });
  return rolesList;
};
export default roleSelect;
