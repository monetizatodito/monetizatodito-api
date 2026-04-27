import { Response, Request } from 'express';

import { UploadedFile } from 'express-fileupload';
import { FileUploadService } from './cargar-archivo.service';
import { CustomError } from '../../error/custom.error';


export class CargarArchivoController {
  // DI
  constructor(private readonly fileUploadService: FileUploadService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.log(`${error}`);
    return res.status(500).json({ error: 'Internal server error' });
  };

  uploadFile = (req: Request, res: Response) => {
    const type = req.params.type;
    const file = req.body.files.at(0) as UploadedFile;

    this.fileUploadService
      .uploadSingle(file, `archivos-cargado/${type}`)
      .then((uploaded) => res.json(uploaded))
      .catch((error) => this.handleError(error, res));
  };

  uploadMultileFiles = (req: Request, res: Response) => {
    const type = req.params.type;
    const files = req.body.files as UploadedFile[];

    this.fileUploadService
      .uploadMultiple(files, `archivos-cargado/${type}`)
      .then((uploaded) => res.json(uploaded))
      .catch((error) => this.handleError(error, res));
  };

  getFile = (req: Request, res: Response) => {
    const { type, fileName } = req.params;
  
    try {
      const filePath = this.fileUploadService.getFileByTypeAndName(type, fileName);
      return res.sendFile(filePath);
    } catch (error) {
      return this.handleError(error, res);
    }
  };
  
  
}