export class PlanesEntity{
    id: string;
    titulo: string;
    precio: number;
    descripcion: string;
    activo?: boolean;
    configuracionId: string;
    createdAt?: Date;
    updatedAt?: Date

}