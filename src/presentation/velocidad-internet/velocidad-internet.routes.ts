import { Router } from "express";

import { AuthMiddleware } from "../middlewares/auth.middleware";

import { ValidardRoll } from "../middlewares/role.middleware";
import { VelocidadInternetControlador } from "./velocidad-internet.controlador";

export class VelocidadInternetRoutes {
  static get routes(): Router {
    const router = Router();

    //const authService = new AuthService(emailService)

    const controller = new VelocidadInternetControlador();

    router.get("/health", controller.salud);
    router.get("/ifaces", controller.ifaces);
    router.get("/wan-speed", controller.wan);
    router.get("/arp-devices", controller.arp);
    router.get("/ping", controller.ping);
    router.get("/download", controller.download);
    router.get("/router-ip", controller.routerIP);
    router.get("/arp-devices-ssh", controller.arpDevicesSsh);
    router.post("/apply-whitelist-openwrt", controller.OpenWrtWhitelist);
    router.post("/apply-whitelist-mikrotik", controller.mikroTikWhitelist);
    router.post("/change-password", controller.changepassword);
    router.post("/upload", controller.upload);

    return router;
  }
}
