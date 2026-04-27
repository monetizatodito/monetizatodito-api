import { Router } from 'express';




import { AuthMiddleware } from '../middlewares/auth.middleware';

import { ValidardRoll } from '../middlewares/role.middleware';
import { RollService } from './roll.service';
import { RollControlador } from './roll.controlador';



export class RollRoutes {
  static get routes(): Router {
    const router = Router();

    //const authService = new AuthService(emailService)
    const rollService = new RollService();
    const controller = new RollControlador (rollService);

    router.post('/', [AuthMiddleware.validateJWT, ValidardRoll.tieneRoll('empresa', 'empresa-admin')], controller.create);
    router.post('/asignar-permiso', [AuthMiddleware.validateJWT, ValidardRoll.tieneRoll('empresa', 'empresa-admin', 'cliente')], controller.asignarPermiso)

    router.get('/', [AuthMiddleware.validateJWT], controller.getRoll);
    router.get('/:id', [AuthMiddleware.validateJWT], controller.getRollId);
    router.get('/:rollId/permiso-roll', [AuthMiddleware.validateJWT], controller.getPermisoRole);
    router.put(
      '/:id',
      [
        AuthMiddleware.validateJWT,
        ValidardRoll.tieneRoll('empresa'),
      ],
      controller.putRoll
    );

    router.delete('/:id',[
      AuthMiddleware.validateJWT, 
      ValidardRoll.tieneRoll('empresa', 'empresa-admin')],
      controller.deleteRoll)

    return router;
  }
}
