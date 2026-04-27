// src/presentation/server.ts (ajusta rutas si cambia tu estructura)
import express, { Application } from "express";
import fileUpload from "express-fileupload";
import cors from "cors";
import dotenv from "dotenv";
import { AppRoutes } from "./routes";
import { buildAllowedOrigins } from "../helpers/cors";
import {
  startFacebookBotWorker,
  stopFacebookBotWorker,
} from "./facebook-bot/facebookBot.worker";

export class Server {
  private app: Application;
  private readonly port: number | string;

  constructor() {
    dotenv.config();
    this.app = express();
    this.port = process.env.PORT || 4000;
  }

  public start() {
    // Recomendado si estás detrás de proxy (Nginx)
    this.app.set("trust proxy", 1);

    // ✅ Mantienes tu lógica actual del traductor
    // (si ENABLE_TRANSLATOR=true, activa parser JSON global)
    process.env.ENABLE_TRANSLATOR === "true" && this.app.use(express.json());

    // ✅ Pero para el webhook de Facebook, SIEMPRE activamos JSON
    // (evita req.body vacío cuando ENABLE_TRANSLATOR=false)
    this.app.use("/webhook/facebook", express.json());

    this.app.use(express.urlencoded({ extended: true }));

    const allowedOrigins = buildAllowedOrigins();
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("Allowed Origins:", allowedOrigins);
    console.log("ENABLE_TRANSLATOR:", process.env.ENABLE_TRANSLATOR);

    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
    const allowedHeaders = [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "x-token",
      "x-user-id",
    ];
    const exposedHeaders = [
      "Content-Disposition",
      "X-Original-Bytes",
      "X-Compressed-Bytes",
      "X-Compression-Ratio",
      "X-Saved-Bytes",
    ];

    const originFn = (
      origin: string | undefined,
      cb: (err: any, allow?: boolean) => void,
    ) => {
      try {
        if (!origin) return cb(null, true); // Postman, SSR, etc.
        if (allowedOrigins.includes(origin)) return cb(null, true);

        if (
          process.env.CORS_ALLOW_VERCEL === "1" &&
          /\.vercel\.app$/i.test(new URL(origin).hostname)
        ) {
          return cb(null, true);
        }

        return cb(null, false);
      } catch (err) {
        console.error("❌ Error validando origin CORS:", { origin, err });
        return cb(null, false);
      }
    };

    const corsMw = cors({
      origin: originFn,
      methods,
      allowedHeaders,
      exposedHeaders,
      credentials: true,
      maxAge: 86400,
    });

    this.app.use(corsMw);
    this.app.options("*", corsMw);

    this.app.use(
      fileUpload({
        useTempFiles: true,
        tempFileDir: "/tmp/",
        limits: { fileSize: 400 * 1024 * 1024 },
      }),
    );

    this.routes();

    const serverInstance = this.app.listen(this.port, () => {
      console.log(`✅ Servidor corriendo en el puerto ${this.port}`);

      // ✅ Iniciar worker del bot (cola en DB)
      startFacebookBotWorker();
    });

    const shutdown = (signal: string) => {
      console.log(`🛑 ${signal} recibido, cerrando worker y servidor...`);

      try {
        stopFacebookBotWorker();
      } catch (err) {
        console.error("❌ Error cerrando worker:", err);
      }

      serverInstance.close(() => {
        console.log("✅ Servidor HTTP cerrado");
        process.exit(0);
      });

      setTimeout(() => {
        console.warn("⚠️ Cierre forzado por timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  }

  private routes() {
    this.app.use(AppRoutes.routes);
  }
}
