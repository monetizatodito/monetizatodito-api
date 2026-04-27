import { Request, Response, NextFunction } from "express";
import { RollService } from '../roll/roll.service';

interface IRoll {
  admin?: string;
  cliente?: string;
  empledo?: string;
  empresa?: string;
  usuario?: string;
}

export class ValidardRoll {
  constructor() {}

  static rollEmpresa = (req: Request, res: Response, next: NextFunction) => {
    if (!req.body.usuario) {
      return res.status(500).json({
        msg: "se quiere autenticar sin validar token",
      });
    }

    const { roll, name } = req.body.usuario;
    if (roll !== "empresa") {
      return res.status(401).json({
        msg: `${name} tu roll no te permite hacer cambios`,
      });
    }
    next();
  };

  static rollCliente = (req: Request, res: Response, next: NextFunction) => {
    if (!req.body.usuario) {
      return res.status(500).json({
        msg: "se quiere autenticar sin validar token",
      });
    }

    const { roll, name } = req.body.usuario;
    if (roll !== "cliente") {
      return res.status(401).json({
        msg: `${name} tu roll no te permite hacer cambios`,
      });
    }
    next();
  };

  static tieneRollS = (...roles: any) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.body.usuario) {
        return res.status(500).json({
          msg: "se quiere autenticar sin validar token",
        });
      }

      if (!roles.includes(req.body.usuario.roll)) {
        return res.status(401).json({
          msg: `tu roll ${req.body.usuario.roll}: no te permite realizar esta acción`,
        });
      }

      next();
    };
  };

  static tieneRoll(...rolesPermitidos: string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.body.usuario) {
          return res.status(500).json({
            msg: "Se quiere autenticar sin validar token",
          });
        }
  
        const { rollId, nombre } = req.body.usuario;
  
        if (!rollId) {
          return res.status(400).json({
            msg: "No se ha proporcionado rollID",
          });
        }
  
        console.log('Roles permitidos:', rolesPermitidos);
        console.log('Usuario:', req.body.usuario);
  
        const roll = await new RollService().getRollId(rollId, req.body.usuario);
        console.log('Resultado de getRollId:', roll);
  
        // Verifica que el roll sea un objeto válido y extrae el valor del rol
        const userRoll = roll?.roll?.roll; // Accede al valor anidado
        if (!userRoll || typeof userRoll !== 'string') {
          return res.status(400).json({
            msg: "El rol no es válido o no fue encontrado",
          });
        }
  
        if (!rolesPermitidos.map(role => role.toLowerCase()).includes(userRoll.toLowerCase())) {
          return res.status(401).json({
            msg: `${nombre}, tu rol no te permite realizar esta acción`,
          });
        }
  
        console.log('Rol validado correctamente:', userRoll);
        next();
      } catch (error: any) {
        console.error('Error en la validación de rol:', error);
        return res.status(500).json({
          msg: "Error interno al validar el rol",
          error: error.message,
        });
      }
    };
  }
  
  
}
