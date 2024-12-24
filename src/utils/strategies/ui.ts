import { Roles } from "../ROLES/roles";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Roles; // Add role property
}
