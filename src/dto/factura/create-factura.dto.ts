export class CreateFacturaDto {
  constructor(
    public id: string,
    public numeroFactura: string,
    public fechaCompra: Date,
    public activo: boolean,
    public provedorId: string,
    public total: number,
    public createdAt?: Date,
    public updatedAt?: Date
  ) {}

  static create(obj: { [key: string]: any }): [string?, CreateFacturaDto?] {
    const { id, numeroFactura, fechaCompra, activo,  provedorId, total, createdAt, updatedAt } = obj;

    // Validación de campos obligatorios
    if (!numeroFactura) return ['El número de factura es obligatorio!!'];
    if (!fechaCompra) return ['La fecha de compra es obligatoria'];
    if (! provedorId) return ['El ID del proveedor es obligatorio'];
    if (total === undefined) return ['El total de la factura es obligatorio'];

    // Convertir fecha de compra a tipo Date
    const fechaCompraDate = new Date(fechaCompra);

    // Verificar si la fecha es válida
    if (isNaN(fechaCompraDate.getTime())) {
      return ['La fecha de compra es inválida'];
    }

    return [
      undefined,
      new CreateFacturaDto(
        id,
        numeroFactura,
        fechaCompraDate,
        activo,
        provedorId,
        total,
        createdAt ? new Date(createdAt) : undefined,
        updatedAt ? new Date(updatedAt) : undefined
      ),
    ];
  }
}
