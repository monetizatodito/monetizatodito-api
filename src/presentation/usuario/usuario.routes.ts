import { Router } from "express";

import { EmailService } from "./service/email.service";
import { envs } from "../../config/envs";
import { AuthService } from "./service/usuario.service";
import { AuthController } from "./usuario.controlador";
import { AuthMiddleware } from "../middlewares/auth.middleware";
import { ValidardRoll } from "../middlewares/role.middleware";

export class UsuarioRoutes {
  static get routes(): Router {
    const router = Router();

    const emailService = new EmailService(
      envs.MAILER_SERVICE,
      envs.MAILER_EMAIL,
      envs.MAILER_SECRET_KEY
    );
    const authService = new AuthService(emailService);
    const controller = new AuthController(authService);

    // 📌 POST routes
    router.post("/register", [AuthMiddleware.validateJWT], controller.create);
    router.post("/login", controller.login);

    // 📌 GET routes (ordenadas de más específicas a más generales)
    router.get(
      "/:id/permisos",
      [AuthMiddleware.validateJWT],
      controller.getUsuarioPermisos
    );
    router.get(
      "/empleado",
      [
        AuthMiddleware.validateJWT,
        ValidardRoll.tieneRoll("empresa", "cliente"),
      ],
      controller.getUsuarioEmpleado
    );
    router.get(
      "/cliente",
      [
        AuthMiddleware.validateJWT,
        ValidardRoll.tieneRoll("empresa", "empresa-admin"),
      ],
      controller.getUsuarioCliente
    );
    router.get("/validate-email/:token", controller.validateEmail);
    router.get(
      "/validar-token",
      AuthMiddleware.validateJWT,
      controller.revalidarToken
    );
    router.get("/nombre/:nombre", controller.getUserNombre); // ✅ Prefijo para evitar conflictos
    router.get("/", [AuthMiddleware.validateJWT], controller.getUser);

    // 📌 PUT routes
    router.put("/:id", AuthMiddleware.validateJWT, controller.putUser);
    router.put("/:id/password", controller.updatePassword);

    // 📌 DELETE route
    router.delete("/eliminar", controller.deleteUser);

    return router;
  }
}
