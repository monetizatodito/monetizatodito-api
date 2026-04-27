import { Router } from 'express';



import { ProductoService } from './producto.service';
import { AuthMiddleware } from '../middlewares/auth.middleware';
import { ProductoController } from './producto.controlador';
import { ValidardRoll } from '../middlewares/role.middleware';


export class ProductoRoutes {
  static get routes(): Router {
    const router = Router();

    //const authService = new AuthService(emailService)
    const productoService = new ProductoService();
    const controller = new ProductoController(productoService);

    router.post('/', [AuthMiddleware.validateJWT], controller.create);

    router.get('/', [AuthMiddleware.validateJWT], controller.getProducto);
    router.get('/:id', controller.getProductoId);
    router.put(
      '/:id',
      [
        AuthMiddleware.validateJWT,
        ValidardRoll.tieneRoll(
          'admin',
          'cliente',
          'empresa',
          'empleado-empresa'
        ),
      ],
      controller.putProducto
    );
    router.delete('/:id', controller.deleteProducto);

    return router;
  }
}
