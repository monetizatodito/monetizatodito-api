import { Request, Response } from 'express';
import { CustomError } from '../../error/custom.error';
import { RollService } from './roll.service';
import { CreateRollDto } from '../../dto/roll/cearte-roll.dto';
import { UpdateRollDto } from '../../dto/roll/update-roll.dto';





export class RollControlador {
  constructor(private readonly rollService: RollService) {}

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
    const [error, rollDto] = CreateRollDto.create(body);
    
    if (error) return res.json({ error });

    this.rollService
      .createRoll(rollDto!, req.body.usuario)
      .then((roll) => res.status(201).json(roll))
      .catch((error) => this.handleError(error, res));
  };






  asignarPermiso = (req: Request, res: Response) => {
    const {rollId, permiso} = req.body;
    
    this.rollService
      .asignarPrmiso(rollId, permiso, req.body.usuario)
      .then((rollPermiso) => res.status(201).json(rollPermiso))
      .catch((error) => this.handleError(error, res));
  };

  getPermisoRole = (req: Request, res: Response) => {
    const {rollId} = req.params;
    
    this.rollService
      .getPermisoRoll(rollId, req.body.usuario)
      .then((rollPermiso) => res.status(201).json(rollPermiso))
      .catch((error) => this.handleError(error, res));
  };



  getRoll = (req: Request, res: Response) => {
    this.rollService
      .getRoll()
      .then((roll) => res.json(roll))
      .catch((err) => this.handleError(err, res));
  };

  getRollId = (req: Request, res: Response) => {
    const { id } = req.params;
    this.rollService
    .getRollId(id, req.body.usuario)
    .then((roll) => res.json(roll))
    .catch((err) => this.handleError(err, res));
  };

  putRoll = (req: Request, res: Response) => {
    const { id } = req.params;
    const [error, updateRollDto] = UpdateRollDto.create({
     
      ...req.body,
     
    });

   
    if (error) return res.status(400).json(error);
    const esAjuste = req.body.ajuste || false; // Suponiendo que `esAjuste` viene en el cuerpo de la solicitud

    this.rollService.putRoll(id, req.body.usuario, updateRollDto!)
      .then((roll) => res.status(200).json(roll))
      .catch((error) => this.handleError(error, res));
  };

  deleteRoll = (req: Request, res: Response) => {
    const { id } = req.params;
    this.rollService.rollDelete(id, req.body.usuario)
    .then((roll) => res.json(roll))
    .catch((err) => this.handleError(err, res));
  };
}
