import { Request, Response } from 'express';
import { CustomError } from '../../error/custom.error';
import { UrlsDto } from '../../dto/urls/urls-dto';
import { UrlService } from './urls.service';







export class UrlControlador {
  constructor(private readonly urlService: UrlService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.log(`${error}`);
    return res.status(500).json({ error: 'Internal server error' });
  };



  create = (req: Request, res: Response) => {
    const body = req.body;
    console.log(body)
    
    const [error, urlDto] = UrlsDto.create(body);
    
    if (error) return res.json({ error });

    this.urlService
      .createUrl(urlDto!)
      .then((roll) => res.status(201).json(roll))
      .catch((error) => this.handleError(error, res));
  };






  

  

  getUrlCorta = (req: Request, res: Response) => {
    const { url_corta } = req.params;

    this.urlService
      .getUrlCorta(url_corta)
      .then((url) => {
        if (!url) {
          return res.status(404).json({ error: "URL no encontrada" });
        }

        // Redirigir a la URL larga si existe
        res.redirect(301, url);
      })
      .catch((err) => this.handleError(err, res));
  };

  

  deleteUrl = (req: Request, res: Response) => {
    const { id } = req.params;
    this.urlService
    .deleteUrl(id)
    .then((url) => res.json(url))
    .catch((err) => this.handleError(err, res));
  };
}
