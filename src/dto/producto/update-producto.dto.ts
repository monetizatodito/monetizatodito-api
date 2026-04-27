

export class UpdateProductoDto {
  private constructor(
    public id: string,
    public codigoB: string,
    public nombre: string,
    public categoria: string,
    public caja: number,
    public laboratorio: string,
    public fraccionCaja: number,
    public unidad: number,
    public precioC: number,
    public precioV: number,
    public precioPVP: number,
    public precioCajaC: number,
    public precioCajaPVP: number,
    public precioCajaV: number,
    public descuentoC: number,
    public descuentoCPor: number,
    public gananciaV: number,
    public gananciaVPor: number,
    public factura: string,
    public numeroFactura: string,
    public configuracionId?: string,
    public descripcion?: string,
    public updatedAt?: Date,
    public iva?: number,
    public cantidad?: number,
    //public ok?: boolean,
    public ice?: number,
    public lote?: Date,
    public images?: string,//public codigoB?: string,
    public ajuste?: boolean
  ) {}

  get values() {
    const obj: { [key: string]: any } = {};

    if (this.codigoB) obj.codigoB = this.codigoB;
    if (this.nombre) obj.nombre = this.nombre;
    if (this.categoria) obj.categoria = this.categoria;
    if (this.caja) obj.caja = this.caja;
    if (this.laboratorio) obj.laboratorio = this.laboratorio;
    if (this.fraccionCaja) obj.fraccionCaja = this.fraccionCaja;
    if (this.unidad) obj.unidad = this.unidad;
    if (this.precioC) obj.precioC = this.precioC;
    if (this.precioV) obj.precioV = this.precioV;
    if (this.precioPVP) obj.precioPVP = this.precioPVP;
    if (this.precioCajaC) obj.precioCajaC = this.precioCajaC;
    if (this.precioCajaPVP) obj.precioCajaPVP = this.precioCajaPVP;
    if (this.precioCajaV) obj.precioCajaV = this.precioCajaV;
    if (this.descuentoC) obj.descuentoC = this.descuentoC;
    if (this.descuentoCPor) obj.descuentoCPor = this.descuentoCPor;
    if (this.gananciaV) obj.gananciaV = this.gananciaV;
    if (this.gananciaVPor) obj.gananciaVPor = this.gananciaVPor;
    if (this.configuracionId) obj.configuracionId = this.configuracionId;
    if (this.descripcion) obj.descripcion = this.descripcion;
    if (this.updatedAt) obj.updatedAt = this.updatedAt;
    if (this.iva) obj.iva = this.iva;
    if (this.cantidad) obj.cantidad = this.cantidad;
    //if (this.ok) obj.ok = this.ok;
    if (this.ice) obj.ice = this.ice;
    if (this.lote) obj.lote = this.lote;
    if (this.images) obj.images = this.images;

    return obj;
  }

  static create(obj: { [key: string]: any }): [string?, UpdateProductoDto?] {
    const {
      id,
      codigoB,
      nombre,
      categoria,
      caja,
      laboratorio,
      fraccionCaja,
      unidad,
      precioC,
      precioV,
      precioPVP,
      precioCajaC,
      precioCajaPVP,
      precioCajaV,
      descuentoC,
      descuentoCPor,
      gananciaV,
      gananciaVPor,
     
      numeroFactura,
      factura,
      configuracionId,
      descripcion,
      updatedAt,
      iva,
      cantidad,
      //ok,
      ice,
      lote,
      images,
      ajuste
    } = obj;

    //if (!UUIDValidator.isValidUUID(id)) return ['no es un id valido!!'];

    let newUpdatetedAt = updatedAt;
    if (updatedAt) {
      newUpdatetedAt = new Date(updatedAt);
      if (newUpdatetedAt.toString() === 'Invalid Date') {
        return ['CompletedAt must be a valid date'];
      }
    }
    return [
      undefined,
      new UpdateProductoDto(
        id,
        codigoB,
        nombre,
        categoria,
        caja,
        laboratorio,
        fraccionCaja,
        unidad,
        precioC,
        precioV,
        precioPVP,
        precioCajaC,
        precioCajaPVP,
        precioCajaV,
        descuentoC,
        descuentoCPor,
        gananciaV,
        gananciaVPor,
        numeroFactura,
        factura,
        configuracionId,
        descripcion,
        newUpdatetedAt,
        iva,
        cantidad,
        //ok,
        ice,
        lote,
        images,
        ajuste
      ),
    ];
  }
}
