import { Router } from 'express';




import { AuthMiddleware } from '../middlewares/auth.middleware';

import { ValidardRoll } from '../middlewares/role.middleware';
import { FacturaService } from './factura.service';
import { FacturaControlador } from './factura.controlador';



export class FacturaRoutes {
  static get routes(): Router {
    const router = Router();

    //const authService = new AuthService(emailService)
    const faturaService = new FacturaService();
    const controller = new FacturaControlador (faturaService);

    router.post('/', [AuthMiddleware.validateJWT], controller.create);

    router.get('/', [AuthMiddleware.validateJWT], controller.getFactura);
    router.get('/:id', [AuthMiddleware.validateJWT], controller.getFacturaId);
    
    router.delete('/:id', 
      [
        AuthMiddleware.validateJWT,
        ValidardRoll.tieneRoll(
          'admin',
          'cliente',
          'empresa',
          'empleado-empresa'
        ),
      ],controller.deleteFactura);

    return router;
  }
}
