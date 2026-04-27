import { Request, Response, NextFunction } from "express";
import { UsuarioRepository } from "../../repositorio/usuario.repositorio";
import { UserEntity } from "../../entity/usuario/user.entity";
import { JwtAdapter } from "../../config/jwt.adapter";

export class AuthMiddleware {
  static usuarioRepositorio = new UsuarioRepository();

  static async validateJWT(req: Request, res: Response, next: NextFunction) {
    const token = req.header("x-token");

    if (!token) {
      console.error("No hay token en la solicitud");
      return res.status(401).json({ error: "no hay un token!!" });
    }

    try {
      const payload: { id: string } | null = await JwtAdapter.validarToken<{
        id: string;
      }>(token);

      if (!payload) {
        console.error("Token no válido");
        return res.status(401).json({ error: "Token no válido" });
      }

      console.log("Payload:", payload);

      const usuario = await AuthMiddleware.usuarioRepositorio.getUsuarioId(
        payload.id
      );

      if (!usuario) {
        console.error(`Usuario no encontrado con id: ${payload.id}`);
        return res.status(400).json({ error: "Usuario no existe" });
      }

      if (usuario.activo === false) {
        console.error(`Usuario con id: ${payload.id} está bloqueado`);
        return res.status(400).json({
          error:
            "El usuario está bloqueado, hable con los administradores del sistema",
        });
      }

      if (usuario.emailValidate === false) {
        console.error("Email no validado");
        return res
          .status(400)
          .json({ error: "Tu email no ha sido confirmado!!" });
      }

      req.body.usuario = usuario;
      //(req as any).usuario = usuario;

      next();
    } catch (error) {
      console.error("Error interno del servidor:", error);
      return res.status(500).json({ error: "Internal server error!!" });
    }
  }
}
