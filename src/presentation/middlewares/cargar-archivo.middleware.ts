import { Request, Response, NextFunction } from 'express';

export class CargarArchivoMiddleWare {
  static archivoMiddleware(req: Request, res: Response, next: NextFunction) {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res
        .status(400)
        .json({ msg: 'no has seleccionado ningun archivo' });
    }

    if (!Array.isArray(req.files.file)) {
      req.body.files = [req.files.file];
    } else {
      req.body.files = [req.files.file];
    }

    next();
  }
}