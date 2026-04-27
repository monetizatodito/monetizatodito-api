import { Request, Response } from 'express';
import { PlanesService } from './planes.service';
import { CustomError } from '../../error/custom.error';
import { CreatePlanesDto } from '../../dto/planes/create-planes.dto';
import { UpdatePlanesDto } from '../../dto/planes/update-planes.entity';

export class PlanesController {
  constructor(private readonly planesService: PlanesService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.log(`${error}`);
    return res.status(500).json({ error: 'Internal server error' });
  };

  create = (req: Request, res: Response) => {
    const body = req.body;
    const [error, createPlanesDto] = CreatePlanesDto.create(body);
    if (error) return res.json({ error });
    this.planesService
      .createPlan(createPlanesDto!, req.body.usuario)
      .then((plan) => res.status(201).json(plan))
      .then((plan) => console.log(plan))
      .catch((error) => this.handleError(error, res));
  };

  getPlanes = (req: Request, res: Response) => {
    this.planesService
      .getPlan(req.body.usuario)
      .then((plan) => res.json(plan))
      .catch((err) => this.handleError(err, res));
  };

  putPlnes = (req: Request, res: Response) => {
    const { id } = req.params;
    const [error, updatePlan] = UpdatePlanesDto.create({
      ...req.body,
      id,
    });

   
    if (error) return res.status(400).json(error);

    this.planesService
      .putPlan(id, req.body.usuario, updatePlan!)
      .then((plan) => res.status(200).json(plan))
      .catch((error) => this.handleError(error, res));
  };
  getPlanId = (req: Request, res: Response) => {
    const { id } = req.params;
    console.log(id);

    this.planesService
      .getPlanId(id)
      .then((plan) => res.json(plan))
      .catch((error) => this.handleError(error, res));
  };

  deleteBlog = (req: Request, res: Response) => {
    const {id} = req.params
    this.planesService.deletePlan(id)
    .then((plan) => res.status(200).json(plan))
    .catch((error) => this.handleError(error, res));
    res.json({ msg: 'hols' });
  };
}
