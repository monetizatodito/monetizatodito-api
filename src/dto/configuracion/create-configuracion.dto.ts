export class CreateConfiguracionDto {
  constructor(
    public id: string,

    public ambiente: string,
    public contabilidad: string,
    public password: string,
    public direccion: string,
    public emision: string,
    public empresa: string,
    public establecimiento: string,
    public estado: boolean,
    public firma: string,
    public tipoRegimen: string,
    public logo: string,
    public numeroF: string,
    public personaSRI: string,
    public razonS: string,
    public retener: string,
    public ruc: string,
    public usuarioId: string,
    public activo: boolean = true,
    public updatedAt?: Date,
    public createdAt?: Date,
  ) {}

  static create(obj: {
    [key: string]: any;
  }): [string?, CreateConfiguracionDto?] {
    const {
      id,
      ambiente,
      contabilidad,
      password,
      direccion,
      emision,
      empresa,
      establecimiento,
      estado = true,
      firma,
      tipoRegimen,
      logo,
      numeroF,
      personaSRI,
      razonS,
      retener,
      ruc,
      usuarioId,
      activo = true,
      updatedAt,
      createdAt,
    } = obj;

    if (!empresa) return ["el nombre de empresa es obligatorio"];
    if (!ambiente) return ["eltipo de ambiente es obligatorio"];
    if (!contabilidad)
      return ["debes de señalar si eres obligado a llevar contabilidad"];
    //if(!password) return ['la contraseña es obligatorio']
    //if(!firma) return ['debes de cargar la firma electrónica']
    if (!ruc) return ["el ruc de  tu empresa es obligatorio"];
    if (!numeroF)
      return [
        "debes de ingresar, desde que valor quieres que empiece tu primera factura",
      ];
    if (!establecimiento)
      return ["el establecimiento de empresa es obligatorio"];
    if (!personaSRI) return ["debes de señalar el tipo de persona SRI"];

    return [
      undefined,
      new CreateConfiguracionDto(
        id,
        ambiente,
        contabilidad,
        password,
        direccion,
        emision,
        empresa,
        establecimiento,
        estado,
        firma,
        tipoRegimen,
        logo,
        numeroF,
        personaSRI,
        razonS,
        retener,
        ruc,
        usuarioId,
        activo,
        updatedAt ?? new Date(),
        createdAt ?? new Date(),
      ),
    ];
  }
}
