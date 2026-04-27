import { Router } from 'express';

import { AuthMiddleware } from '../middlewares/auth.middleware';

import { ValidardRoll } from '../middlewares/role.middleware';
import { FileUploadController } from './pdf-work.controlador';
import { TypeMiddleware } from '../middlewares/type-files';


export class ConvertirRoutes {
  static get routes(): Router {
    const router = Router();
   
    const controller = new FileUploadController()

   

    router.post(
      '/',controller.uploadFile
    );
    

   

    return router;
  }
}
