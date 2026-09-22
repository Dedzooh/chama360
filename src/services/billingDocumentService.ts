import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import type { BillingDocumentType, PlanChangeRequest } from '@prisma/client';
import { prisma } from '../config/database';
import { config } from '../config/environment';

const documentNumber = (type: BillingDocumentType, paymentId: string, date = new Date()) => `${type === 'INVOICE' ? 'INV' : type === 'RECEIPT' ? 'RCT' : 'CRN'}-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${paymentId.slice(-8).toUpperCase()}`;
const amounts = (total: number) => { const rate = Math.max(0, config.billing.vatRate); const subtotal = total / (1 + rate / 100); return { subtotal: Math.round(subtotal * 100) / 100, taxRate: rate, taxAmount: Math.round((total - subtotal) * 100) / 100, total }; };
const billingPeriod = (request: Pick<PlanChangeRequest, 'billingCycle' | 'paidAt' | 'createdAt'>) => { const start = request.paidAt ?? request.createdAt; const end = new Date(start); if (request.billingCycle === 'ANNUAL') end.setFullYear(end.getFullYear() + 1); else end.setMonth(end.getMonth() + 1); return { start, end }; };
const csvCell = (value: unknown) => {
  let text = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export const billingDocumentService = {
  async recordRefund(paymentRequestId: string, reason: string, refundReference: string) {
    const request = await prisma.planChangeRequest.findUnique({ where: { id: paymentRequestId }, include: { organization: true } });
    if (!request?.organizationId || request.status !== 'COMPLETED') throw new Error('Only a completed organization payment can be refunded.');
    const existingReference = await prisma.billingDocument.findFirst({ where: { paymentReference: refundReference } });
    if (existingReference) throw new Error('This refund reference has already been recorded.');
    const amount = amounts(Number(request.amount)); const period = billingPeriod(request); const now = new Date();
    const creditNote = await prisma.$transaction(async (tx) => {
      const created = await tx.billingDocument.create({ data: { documentNumber: documentNumber('CREDIT_NOTE', request.id, now), type: 'CREDIT_NOTE', status: 'REFUNDED', organizationId: request.organizationId!, paymentRequestId: request.id, plan: request.requestedPlan, billingCycle: request.billingCycle, currency: request.currency, subtotal: -amount.subtotal, taxRate: amount.taxRate, taxAmount: -amount.taxAmount, total: -amount.total, periodStart: period.start, periodEnd: period.end, paymentReference: refundReference, issuedAt: now, paidAt: now, metadata: { reason, originalPaymentReference: request.receiptNumber, businessName: config.billing.businessName, businessAddress: config.billing.businessAddress, taxPin: config.billing.taxPin } } });
      await tx.billingDocument.updateMany({ where: { paymentRequestId: request.id, type: { in: ['INVOICE', 'RECEIPT'] } }, data: { status: 'REFUNDED' } });
      await tx.organizationSubscription.update({ where: { organizationId: request.organizationId! }, data: { plan: 'FREE', status: 'CANCELLED', currentPeriodEnd: now, gracePeriodEnd: null, cancelAtPeriodEnd: false } });
      return created;
    });
    return creditNote;
  },

  async ensureForPayment(paymentRequestId: string) {
    const request = await prisma.planChangeRequest.findUnique({ where: { id: paymentRequestId }, include: { user: { select: { id: true, email: true, phone: true, notificationPreferences: true } } } });
    if (!request?.organizationId) return [];
    const amount = amounts(Number(request.amount)); const period = billingPeriod(request);
    const invoice = await prisma.billingDocument.upsert({
      where: { paymentRequestId_type: { paymentRequestId: request.id, type: 'INVOICE' } }, update: request.status === 'COMPLETED' ? { status: 'PAID', paidAt: request.paidAt, paymentReference: request.receiptNumber, periodStart: period.start, periodEnd: period.end } : {},
      create: { documentNumber: documentNumber('INVOICE', request.id, request.createdAt), type: 'INVOICE', status: request.status === 'COMPLETED' ? 'PAID' : 'ISSUED', organizationId: request.organizationId, paymentRequestId: request.id, plan: request.requestedPlan, billingCycle: request.billingCycle, currency: request.currency, ...amount, periodStart: period.start, periodEnd: period.end, paymentReference: request.receiptNumber, paidAt: request.paidAt, metadata: { businessName: config.billing.businessName, businessAddress: config.billing.businessAddress, taxPin: config.billing.taxPin } },
    });
    if (request.status !== 'COMPLETED') return [invoice];
    const receipt = await prisma.billingDocument.upsert({
      where: { paymentRequestId_type: { paymentRequestId: request.id, type: 'RECEIPT' } }, update: {},
      create: { documentNumber: documentNumber('RECEIPT', request.id, request.paidAt ?? request.createdAt), type: 'RECEIPT', status: 'PAID', organizationId: request.organizationId, paymentRequestId: request.id, plan: request.requestedPlan, billingCycle: request.billingCycle, currency: request.currency, ...amount, periodStart: period.start, periodEnd: period.end, paymentReference: request.receiptNumber, paidAt: request.paidAt, metadata: { businessName: config.billing.businessName, businessAddress: config.billing.businessAddress, taxPin: config.billing.taxPin } },
    });
    const preferences = request.user.notificationPreferences;
    const channels = [
      ...(preferences?.inAppEnabled !== false ? [{ type: 'IN_APP' as const, address: request.user.id }] : []),
      ...(preferences?.emailEnabled !== false && config.email.host && config.email.user && config.email.from ? [{ type: 'EMAIL' as const, address: request.user.email }] : []),
      ...(preferences?.smsEnabled !== false && config.sms.baseUrl && config.sms.apiKey && config.sms.senderId ? [{ type: 'SMS' as const, address: request.user.phone }] : []),
    ];
    if (channels.length) await prisma.notification.upsert({ where: { dedupeKey: `BILLING_RECEIPT_${receipt.id}` }, update: {}, create: { dedupeKey: `BILLING_RECEIPT_${receipt.id}`, recipientId: request.user.id, organizationId: request.organizationId, type: 'GENERAL_UPDATE', priority: 'INFO', title: `Payment receipt ${receipt.documentNumber}`, message: `Your ${request.requestedPlan} subscription payment of ${request.currency} ${Number(request.amount).toLocaleString()} was confirmed. Open Plans and Billing History to download the official PDF receipt.`, channels: { create: channels } } });
    return [invoice, receipt];
  },

  async backfill() {
    const requests = await prisma.planChangeRequest.findMany({ where: { organizationId: { not: null } }, select: { id: true } });
    for (const request of requests) await this.ensureForPayment(request.id);
    return requests.length;
  },

  async renderPdf(id: string) {
    const item = await prisma.billingDocument.findUnique({ where: { id }, include: { organization: true, paymentRequest: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } } });
    if (!item) return null;
    const pdf = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `${item.type} ${item.documentNumber}`, Author: config.billing.businessName } }); const chunks: Buffer[] = [];
    pdf.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    const done = new Promise<Buffer>((resolve) => pdf.on('end', () => resolve(Buffer.concat(chunks))));
    const logo = path.join(process.cwd(), 'client', 'public', 'logo.png'); if (fs.existsSync(logo)) { try { pdf.image(logo, 48, 42, { width: 56 }); } catch { /* Text branding remains available. */ } }
    pdf.fillColor('#087457').fontSize(22).font('Helvetica-Bold').text('CHAMAZ360', 118, 48).fontSize(9).fillColor('#71808b').text('TOGETHER · GROW · PROSPER', 118, 75);
    pdf.fontSize(10).fillColor('#4d5d68').text(config.billing.businessAddress, 360, 48, { width: 185, align: 'right' }); if (config.billing.taxPin) pdf.text(`Tax PIN: ${config.billing.taxPin}`, 360, 63, { width: 185, align: 'right' });
    pdf.moveTo(48, 112).lineTo(547, 112).strokeColor('#d7e5df').stroke(); pdf.moveDown(5);
    pdf.fillColor('#09253e').fontSize(26).font('Helvetica-Bold').text(item.type.replace('_', ' '), 48, 140); pdf.fontSize(11).font('Helvetica').fillColor('#536674').text(item.documentNumber, 48, 174);
    pdf.font('Helvetica-Bold').fillColor('#09253e').text('BILLED TO', 48, 215).font('Helvetica').fillColor('#536674').text(item.organization.name, 48, 234).text(item.paymentRequest?.user.email ?? '', 48, 250);
    pdf.font('Helvetica-Bold').fillColor('#09253e').text('DOCUMENT DETAILS', 330, 215).font('Helvetica').fillColor('#536674').text(`Issued: ${item.issuedAt.toLocaleDateString()}`, 330, 234).text(`Status: ${item.status}`, 330, 250).text(`Billing: ${item.billingCycle}`, 330, 266);
    pdf.roundedRect(48, 310, 499, 34, 5).fill('#087457'); pdf.fillColor('#fff').font('Helvetica-Bold').fontSize(10).text('DESCRIPTION', 62, 322).text('AMOUNT', 435, 322, { width: 95, align: 'right' });
    pdf.fillColor('#203746').font('Helvetica').fontSize(11).text(`${item.plan} chama subscription · ${item.billingCycle.toLowerCase()}`, 62, 365).text(`${item.currency} ${Number(item.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 435, 365, { width: 95, align: 'right' });
    pdf.moveTo(48, 397).lineTo(547, 397).strokeColor('#d7e5df').stroke(); let y = 420;
    [['Subtotal', Number(item.subtotal)], [`Tax (${Number(item.taxRate)}%)`, Number(item.taxAmount)], ['TOTAL', Number(item.total)]].forEach(([label, value]) => { pdf.font(label === 'TOTAL' ? 'Helvetica-Bold' : 'Helvetica').fillColor(label === 'TOTAL' ? '#087457' : '#536674').text(String(label), 350, y).text(`${item.currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 435, y, { width: 95, align: 'right' }); y += 24; });
    if (item.paymentReference) pdf.roundedRect(48, 520, 499, 58, 7).fill('#eef8f4').fillColor('#087457').font('Helvetica-Bold').text('PAYMENT CONFIRMATION', 62, 535).font('Helvetica').fillColor('#36584d').text(`Reference: ${item.paymentReference}`, 62, 553);
    pdf.fillColor('#7b8992').fontSize(9).text('Thank you for using CHAMAZ360. This document was generated electronically and is traceable using its document number.', 48, 735, { width: 499, align: 'center' }); pdf.end();
    return { item, buffer: await done };
  },

  async reconciliationCsv() {
    const documents = await prisma.billingDocument.findMany({ include: { organization: { select: { name: true } } }, orderBy: { issuedAt: 'desc' } });
    const rows = [
      ['Document', 'Type', 'Chama', 'Plan', 'Cycle', 'Status', 'Currency', 'Subtotal', 'Tax', 'Total', 'Reference', 'Issued'],
      ...documents.map((item) => [item.documentNumber, item.type, item.organization.name, item.plan, item.billingCycle, item.status, item.currency, Number(item.subtotal), Number(item.taxAmount), Number(item.total), item.paymentReference ?? '', item.issuedAt]),
    ];
    return Buffer.from(`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`, 'utf8');
  },
};
