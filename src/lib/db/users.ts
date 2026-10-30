import "server-only";
import { ConflictError } from "@/lib/http/errors";
import { getDb } from "./client";

const UNIQUE_VIOLATION = "23505";
const PUBLIC_COLUMNS = "id, email, name, created_at, updated_at";

type UserRow = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type UserRowWithPasswordHash = UserRow & { password_hash: string };

export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type UserWithPasswordHash = User & { passwordHash: string };

export type NewUser = {
  email: string;
  name: string;
  passwordHash: string;
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findUserByEmail(
  email: string,
): Promise<UserWithPasswordHash | null> {
  const { data, error } = await getDb()
    .from("users")
    .select(`${PUBLIC_COLUMNS}, password_hash`)
    .eq("email", email)
    .maybeSingle<UserRowWithPasswordHash>();
  if (error) {
    throw new Error(`Could not load user: ${error.message}`);
  }
  return data ? { ...toUser(data), passwordHash: data.password_hash } : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const { data, error } = await getDb()
    .from("users")
    .select(PUBLIC_COLUMNS)
    .eq("id", id)
    .maybeSingle<UserRow>();
  if (error) {
    throw new Error(`Could not load user: ${error.message}`);
  }
  return data ? toUser(data) : null;
}

export async function insertUser(user: NewUser): Promise<User> {
  const { data, error } = await getDb()
    .from("users")
    .insert({
      email: user.email,
      name: user.name,
      password_hash: user.passwordHash,
    })
    .select(PUBLIC_COLUMNS)
    .single<UserRow>();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new ConflictError("An account with this email already exists.");
    }
    throw new Error(`Could not create user: ${error.message}`);
  }
  return toUser(data);
}
