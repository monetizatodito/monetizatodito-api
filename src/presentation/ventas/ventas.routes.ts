// src/presentation/ventas/ventas.routes.ts
import { Router } from "express";
import { PaymentsController } from "./ventas.controlador";
import { AuthMiddleware } from "../middlewares/auth.middleware"; // ajusta path si difiere

export class PaymentsRoutes {
  static get routes(): Router {
    const r = Router();
    const ctrl = new PaymentsController();

    // Público: lo llama el cliente tras actions.order.capture()
    r.post("/paypal", ctrl.storeFromClient);

    // Admin: listado (tu panel ya lo consume)
    r.get("/", AuthMiddleware.validateJWT, ctrl.list);

    return r;
  }
}
