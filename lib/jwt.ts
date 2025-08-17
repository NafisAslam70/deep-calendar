import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "dev-secret");
const ALG = "HS256";

export async function signToken(payload: { uid: number; email: string }, expSec = 60 * 60 * 24 * 30) {
  return await new SignJWT(payload).setProtectedHeader({ alg: ALG }).setIssuedAt().setExpirationTime(`${expSec}s`).sign(secret);
}

export async function verifyToken<T = any>(token: string) {
  const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
  return payload as T;
}
