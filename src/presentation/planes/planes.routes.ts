import { Router } from 'express';

import { AuthMiddleware } from '../middlewares/auth.middleware';
import { PlanesService } from './planes.service';
import { ValidardRoll } from '../middlewares/role.middleware';
import { PlanesController } from './planes.controlador';

export class PlanesRoutes {
  static get routes(): Router {
    const router = Router();
    const planesService = new PlanesService();
    const controller = new PlanesController(planesService);

    router.get('/', controller.getPlanes);
    router.post('/', [AuthMiddleware.validateJWT, ValidardRoll.tieneRoll( 'empresa', 'empresa-admin')], controller.create);
    router.put('/:id', [AuthMiddleware.validateJWT, ValidardRoll.tieneRoll( 'empresa', 'empresa-admin')], controller.putPlnes);
    router.get('/:id', controller.getPlanId);
    router.delete('/:id', [AuthMiddleware.validateJWT, ValidardRoll.tieneRoll( 'empresa', 'empresa-admin')], controller.deleteBlog);

    return router;
  }
}
