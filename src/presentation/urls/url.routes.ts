import { Router } from 'express';

import { AuthMiddleware } from '../middlewares/auth.middleware';
import { UrlService } from './urls.service';
import { UrlControlador } from './url.controlador';



export class UrlRoutes {
  static get routes(): Router {
    const router = Router();

    //const authService = new AuthService(emailService)
    const urlService = new UrlService();
    const controller = new UrlControlador (urlService);

    router.post('/', controller.create);
   

    
    router.get('/:url_corta', controller.getUrlCorta);
   

    router.delete('/:id',
      controller.deleteUrl)

    return router;
  }
}
