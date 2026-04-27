export class FacturaEntity{
    id: string;
    numeroFactura: string;
    fechaCompra: Date;
    provedorId: string;
    total: number;
    activo: boolean;
    createdAt?: Date;
    updatedAt?: Date
}