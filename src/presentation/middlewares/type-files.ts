import { NextFunction, Request, Response } from 'express';

export class TypeMiddleware {
  static validTypes(validTypes: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Asegurarse de que siempre se está manejando una URL limpia
      const urlSegments = req.url.split('/').filter(Boolean);
      
      // Obtener el tipo de la URL
      const type = urlSegments[1] ?? '';  // Si existe al menos 2 segmentos, tomar el 2do

      // Validar si el tipo es válido
      if (!validTypes.includes(type)) {
        return res
          .status(400)
          .json({ error: `Invalid type: ${type}. Valid types are: ${validTypes.join(', ')}` });
      }

      // Si todo está bien, pasar al siguiente middleware
      next();
    };
  }
}
