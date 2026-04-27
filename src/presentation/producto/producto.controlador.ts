import { Request, Response } from 'express';
import { CustomError } from '../../error/custom.error';
import { ProductoService } from './producto.service';
import { CreateProductoDto } from '../../dto/producto/create-producto.dto';
import { UpdateProductoDto } from '../../dto/producto/update-producto.dto';



export class ProductoController {
  constructor(private readonly productoService: ProductoService) {}

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
    const [error, createProductoDto] = CreateProductoDto.create(body);
    console.log(createProductoDto);
    if (error) return res.json({ error });

    this.productoService
      .createProducto(createProductoDto!, req.body.usuario)
      .then((producto) => res.status(201).json(producto))
      .catch((error) => this.handleError(error, res));
  };

  getProducto = (req: Request, res: Response) => {
    this.productoService
      .getProductos(req.body.usuario)
      .then((producto) => res.json(producto))
      .catch((err) => this.handleError(err, res));
  };

  getProductoId = (req: Request, res: Response) => {
    res.json({ msg: 'hols' });
  };

  putProducto = (req: Request, res: Response) => {
    const { id } = req.params;
    const [error, updateProductoDto] = UpdateProductoDto.create({
      ...req.body,
      id,
    });

    console.log('producto', updateProductoDto)
    if (error) return res.status(400).json(error);
    const esAjuste = req.body.ajuste || false; // Suponiendo que `esAjuste` viene en el cuerpo de la solicitud

    this.productoService
      .putProducto(id, req.body.usuario, updateProductoDto!,esAjuste)
      .then((producto) => res.status(200).json(producto))
      .catch((error) => this.handleError(error, res));
  };

  deleteProducto = (req: Request, res: Response) => {
    res.json({ msg: 'hols' });
  };
}
