import { Member, Role } from "@localfirst/auth";

export enum RoleName {
  ADMIN = 'admin',
  MEMBER = 'member',
}

export type RoleMemberInfo = {
  id: string;
  name: string;
}

export type BaseChannel = Role & {
  channelName: string;
  hasRole: boolean; // Do I have access to this role?
}

export type Channel = BaseChannel & {
  members: Member[]
}

export type TruncatedChannel = BaseChannel & {
  members: RoleMemberInfo[]
}