import jwt from "jsonwebtoken";

export function generateTestToken(secret: string): string {
  return jwt.sign(
    { sub: "test-user", email: "test@finchly.dev" },
    secret,
    { issuer: "finchly", expiresIn: "1h" },
  );
}
