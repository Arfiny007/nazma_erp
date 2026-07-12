import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

const TEMP_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";

export function generateTemporaryPassword(length = 14): string {
  const bytes = randomBytes(length);
  let password = "";

  for (let index = 0; index < length; index += 1) {
    password += TEMP_PASSWORD_ALPHABET[bytes[index]! % TEMP_PASSWORD_ALPHABET.length];
  }

  return password;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
