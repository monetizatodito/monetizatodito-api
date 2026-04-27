import jwt, { SignOptions } from "jsonwebtoken";
import { envs } from "./envs";

const FIRMA_TOKEN = envs.FIRMA_TOKEN as string;

export class JwtAdapter {
  static async generarToken(
    payload: string | object | Buffer,
    duration: SignOptions["expiresIn"] = "8h"
  ): Promise<string | null> {
    return new Promise((resolve) => {
      jwt.sign(payload, FIRMA_TOKEN, { expiresIn: duration }, (err, token) => {
        if (err || !token) return resolve(null);
        resolve(token);
      });
    });
  }

  static validarToken<T>(token: string): Promise<T | null> {
    return new Promise((resolve) => {
      jwt.verify(token, FIRMA_TOKEN, (err, decoded) => {
        if (err) return resolve(null);
        resolve(decoded as T);
      });
    });
  }
}
