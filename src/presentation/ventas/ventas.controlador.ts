import { Request, Response } from "express";
import { PaymentsService } from "./ventas.service";

export class PaymentsController {
  constructor(private readonly service = new PaymentsService()) {}

  storeFromClient = async (req: Request, res: Response) => {
    try {
      const { type, libroId, payload } = req.body || {};
      if (!payload || !type) {
        return res
          .status(400)
          .json({ ok: false, msg: "type y payload son requeridos" });
      }

      const saved = await this.service.createFromPaypalClient({
        type,
        libroId,
        payload,
      });
      return res.status(201).json({ ok: true, data: saved });
    } catch (e: any) {
      console.error("storeFromClient:", e);
      return res
        .status(500)
        .json({ ok: false, msg: e?.message || "Error interno" });
    }
  };

  list = async (req: Request, res: Response) => {
    try {
      const { type, libroId, limit } = req.query as any;
      const rows = await this.service.list({
        type,
        libroId,
        limit: limit ? Number(limit) : undefined,
      });
      return res.json({ ok: true, data: rows });
    } catch (e: any) {
      console.error("list:", e);
      return res
        .status(500)
        .json({ ok: false, msg: e?.message || "Error interno" });
    }
  };
}
