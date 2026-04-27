import { PaymentsRepository } from "./venta.repositorio";
import { fetchOrderOrCapture, extractPayInfo } from "./paypal.helper";
import { PAYPAL_CURRENCY } from "./paypal.config";

export class PaymentsService {
  constructor(private readonly repo = new PaymentsRepository()) {}

  /**
   * Crea un registro a partir del capture del cliente,
   * verificando la transacción con PayPal (server-to-server).
   */
  async createFromPaypalClient(body: {
    type: "purchase" | "donation";
    libroId?: string | null;
    payload: any; // objeto devuelto por actions.order.capture()
  }) {
    const clientPayload = body.payload;

    // 1) Intentamos obtener un ID de PayPal razonable (order/capture ID)
    const clientId =
      clientPayload?.purchase_units?.[0]?.payments?.captures?.[0]?.id ||
      clientPayload?.id ||
      "";

    if (!clientId) {
      throw new Error(
        "No se pudo inferir un ID de PayPal desde el payload del cliente."
      );
    }

    // 2) Verificación server-to-server
    const serverNode = await fetchOrderOrCapture(clientId);
    if (!serverNode)
      throw new Error("No se pudo verificar la transacción en PayPal.");

    const verified = extractPayInfo(serverNode); // { id, amount, currency, status }

    // 3) Chequeos mínimos (puedes endurecer más si quieres)
    if (verified.status !== "COMPLETED") {
      throw new Error(
        `La transacción aún no está COMPLETED (estado: ${verified.status}).`
      );
    }
    if (verified.currency !== PAYPAL_CURRENCY) {
      throw new Error(
        `Moneda inesperada: ${verified.currency}, se esperaba ${PAYPAL_CURRENCY}.`
      );
    }

    // 4) Datos “bonitos” del pagador (del payload del cliente)
    const payerEmail =
      clientPayload?.payer?.email_address ??
      clientPayload?.payment_source?.paypal?.email_address ??
      null;

    const payerName =
      [
        clientPayload?.payer?.name?.given_name ?? "",
        clientPayload?.payer?.name?.surname ?? "",
      ]
        .join(" ")
        .trim() || null;

    // 5) Guardamos con los valores verificados
    const saved = await this.repo.upsert({
      provider: "paypal",
      provider_id: verified.id,
      status: verified.status,
      type: body.type,
      libro_id: body.libroId ?? null,
      amount: verified.amount,
      currency: verified.currency,
      payer_email: payerEmail,
      payer_name: payerName,
      raw: clientPayload, // opcional: también podrías guardar el serverNode
    });

    return saved;
  }

  list(params: { type?: string; libroId?: string; limit?: number }) {
    return this.repo.listAdmin(params);
  }
}
