import { Request, Response } from 'express';
import { CustomError } from '../../error/custom.error';


import { CreateFacturaDto } from '../../dto/factura/create-factura.dto';
import { FacturaService } from './factura.service';





export class FacturaControlador {
  constructor(private readonly facturaService: FacturaService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.log(`${error}`);
    return res.status(500).json({ error: 'Internal server error' });
  };



  create = (req: Request, res: Response) => {
    const body = req.body;
    console.log('ffffoooo',body)
    const [error, createFacturaDto] = CreateFacturaDto.create(body);
    
    if (error) return res.json({ error });

    this.facturaService
    .createFactura(createFacturaDto!, req.body.usuario)
      .then((factura) => res.status(201).json(factura))
      .catch((error) => this.handleError(error, res));
  };

  getFactura = (req: Request, res: Response) => {
    this.facturaService
      .getFactura(req.body.usuario)
      .then((fatura) => res.json(fatura))
      .catch((err) => this.handleError(err, res));
  };

  getFacturaId = (req: Request, res: Response) => {
    const { id } = req.params;
    this.facturaService
    .getFacturaId(id, req.body.usuario)
    .then((fatura) => res.json(fatura))
    .catch((err) => this.handleError(err, res));
  };

  

  deleteFactura = (req: Request, res: Response) => {
    const { id } = req.params;
    this,this.facturaService
    .deleteFatura(id, req.body.usuario)
    .then((factura) => res.json(factura))
    .catch((err) => this.handleError(err, res));
  };
}
