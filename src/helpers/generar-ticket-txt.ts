import { Request, Response } from 'express';

interface ShippingAddress {
    cedula: string;
    nombre: string;
    email: string;
    celular: string;
    direccion: string;
}

interface OrderItem {
    id: string;
    nombre: string;
    cantidad: number;
    precioV: number;
}

interface CompanyInfo {
    nombre: string;
    direccion: string;
    telefono: string;
    email: string;
}

interface TicketData {
    numeroTicket: string; // Número de ticket
    tipo: string;
    numberItem: number;
    subTotalV: number;
    subTotalC: number;
    subTotalPVP: number;
    totalV: number;
    totalC: number;
    totalPVP: number;
    iva: number;
    isPaid: boolean;
    paidAt: boolean;
    shippingAddress: ShippingAddress;
    orderItem: OrderItem[];
}

// Función para generar el contenido del ticket en formato de texto
export function generarTicket(data: any, empresa: CompanyInfo): string {
    console.log('desde ticket', data);
    
    const { numeroTicket, tipo, numberItem, subTotalV, subTotalC, subTotalPVP, totalV, totalC, totalPVP, iva, isPaid, paidAt, shippingAddress, orderItem } = data.orden;

    let ticketContent = '';
    
    // Información de la empresa
    ticketContent += `***** ${empresa.nombre.toUpperCase()} *****\n`;
    ticketContent += `Dir: ${empresa.direccion}\n`;
    ticketContent += `Tel: ${empresa.telefono}\n`;
    ticketContent += `Email: ${empresa.email}\n`;
    ticketContent += `--------------------------------\n\n`;
    
    // Información del ticket
    ticketContent += `***** ${tipo.toUpperCase()} *****\n`;
    ticketContent += `N° Ticket: ${numeroTicket || 'N/A'}\n\n`; // Usar 'N/A' si numeroTicket no está definido
    ticketContent += `Cliente: ${shippingAddress.nombre}\n`;
    ticketContent += `Cédula: ${shippingAddress.cedula}\n`;
    ticketContent += `Email: ${shippingAddress.email}\n`;
    ticketContent += `Celular: ${shippingAddress.celular}\n`;
    ticketContent += `Dirección: ${shippingAddress.direccion}\n\n`;

    ticketContent += `N° Ítems: ${numberItem}\n`;
    ticketContent += `-----------------------------\n`;
    ticketContent += `| descripción         | Cant | Precio.U  |\n`; // Encabezados
    ticketContent += `-----------------------------\n`;

    orderItem.forEach((item: OrderItem, index: number) => {
        const precioV = Number(item.precioV); // Asegúrate de que sea un número
        if (isNaN(precioV)) {
            console.error(`Error: precioV for item ${index} is not a number.`);
            return; // O maneja el error de alguna otra manera
        }

        // Alinear la salida con espacios
        ticketContent += `| ${item.nombre.padEnd(18)} | ${item.cantidad.toString().padStart(5)} | $${precioV.toFixed(2).padStart(7)} |\n`;
    });

    ticketContent += `-----------------------------\n`;
    ticketContent += `Subtotal: $${Number(subTotalV).toFixed(2)}\n`;
    ticketContent += `Costo: $${Number(subTotalC).toFixed(2)}\n`;
    ticketContent += `PVP: $${Number(subTotalPVP).toFixed(2)}\n`;
    ticketContent += `IVA (${(iva * 100).toFixed(0)}%): $${(totalPVP * iva).toFixed(2)}\n\n`;
    
    ticketContent += `Total: $${Number(totalV).toFixed(2)}\n`;
    ticketContent += `Estado: ${isPaid ? 'Pagado' : 'Pendiente'}\n`;
    ticketContent += `Fecha: ${paidAt ? new Date().toLocaleString() : '---'}\n\n`;
    ticketContent += `***** Gracias por su compra *****\n`;

    console.log('ticket generado', ticketContent);

    return ticketContent;
}
