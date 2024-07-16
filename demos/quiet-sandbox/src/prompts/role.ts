import { roles, users, Role } from "../data/testTeamInfo.js";
import inquirer from "inquirer";
import actionSelect from "../components/actionSelect.js";
import { select } from "inquirer-select-pro";

const roleView = async (roleName: string) => {
  const role = roles.find((role) => role.name === roleName);
  if (!role) {
    console.log("Role not found");
    return;
  }
  let exit = false;
  while (exit === false) {
    const answer = await inquirer.prompt([
      {
        type: "select",
        name: "action",
        message: `Role: ${role.name}\n Description: ${role.description}\n`,
        choices: [
          { name: "Edit members", value: "members", description: "View members of the role" },
          { name: "Edit permissions", value: "edit", description: "Edit the role" },
          { name: "Delete role", value: "delete", description: "Delete the role" },
          { name: "Exit", value: "exit", description: "Return to roles list" },
        ],
      },
    ]);

    switch (answer.action) {
      case "members":
        const members = await memberEdit(role);
        console.log("Changing members not implemented");
        break;
      case "edit":
        console.log("Role editing not implmented");
        break;
      case "delete":
        console.log("Deleting role not implmented");
        break;
      case "exit":
        exit = true;
        break;
    };
  };
};

const memberEdit = async (role: Role) => {
  let members = users.map((user) => {
    return {
      name: user.name,
      value: user.name,
    };
  }
  );
  const selectedMembers = await select({
    message: "Select members to add or remove",
    options: members,
    multiple: true,
  });
  return selectedMembers;
}

export { roleView, memberEdit };
