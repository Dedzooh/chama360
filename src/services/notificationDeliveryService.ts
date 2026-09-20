import nodemailer from 'nodemailer';
import type { NotificationChannelType } from '@prisma/client';
import { prisma } from '../config/database';
import { config } from '../config/environment';
import { logger } from '../config/logger';

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] ?? character));
const emailTransport = config.email.host && config.email.user && config.email.password
  ? nodemailer.createTransport({ host: config.email.host, port: config.email.port, secure: config.email.port === 465, auth: { user: config.email.user, pass: config.email.password } }) : null;

export const sendTransactionalEmail = async (address: string, title: string, message: string) => {
  if (!emailTransport || !config.email.from) throw new Error('Email provider is not configured');
  const plansUrl = `${config.server.webUrl.replace(/\/$/, '')}/upgrade`;
  await emailTransport.sendMail({
    from: `CHAMA360 <${config.email.from}>`, to: address, subject: title,
    text: `${message}\n\nManage your chama plan: ${plansUrl}`,
    html: `<div style="margin:0;background:#f3f7f5;padding:32px 16px;font-family:Arial,sans-serif;color:#173042"><div style="max-width:600px;margin:auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 35px rgba(5,60,45,.10)"><div style="padding:24px 28px;background:linear-gradient(135deg,#087457,#0b2f4f);color:#fff"><strong style="font-size:22px">CHAMA<span style="color:#f0b829">360</span></strong><div style="margin-top:5px;font-size:12px;opacity:.8">TOGETHER · GROW · PROSPER</div></div><div style="padding:30px 28px"><h1 style="margin:0 0 14px;font-size:24px;color:#09253e">${escapeHtml(title)}</h1><p style="margin:0;color:#536674;line-height:1.7">${escapeHtml(message)}</p><a href="${plansUrl}" style="display:inline-block;margin-top:24px;padding:13px 20px;border-radius:10px;background:#087457;color:#fff;text-decoration:none;font-weight:700">Manage chama plan</a><p style="margin:28px 0 0;color:#89969f;font-size:12px">This operational message was sent to a chama administrator. Notification preferences can be managed inside CHAMA360.</p></div></div></div>`,
  });
};

export const sendTransactionalSms = async (address: string, message: string) => {
  if (!config.sms.baseUrl || !config.sms.apiKey || !config.sms.senderId) throw new Error('SMS provider is not configured');
  const response = await fetch(config.sms.baseUrl, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.sms.apiKey}` }, body: JSON.stringify({ to: address, message: `${message} Open CHAMA360 to manage your plan.`, senderId: config.sms.senderId }) });
  if (!response.ok) throw new Error(`SMS provider returned HTTP ${response.status}`);
};

const deliver = async (type: NotificationChannelType, address: string, title: string, message: string) => {
  if (type === 'IN_APP') return;
  if (type === 'PUSH') throw new Error('Push provider is not configured');
  if (type === 'EMAIL') return sendTransactionalEmail(address, title, message);
  if (type === 'SMS') return sendTransactionalSms(address, message);
};

const reserveSmsCredit = async (organizationId: string) => {
  const reserved = await prisma.organizationSmsCredit.updateMany({
    where: { organizationId, balance: { gt: 0 } },
    data: { balance: { decrement: 1 }, consumed: { increment: 1 } },
  });
  if (reserved.count !== 1) throw new Error('No SMS credits remain for this organization');
};

export const notificationDeliveryService = {
  async processPending(limit = 100) {
    const channels = await prisma.notificationChannel.findMany({ where: { OR: [{ status: 'PENDING' }, { status: 'FAILED', retryCount: { lt: 3 } }] }, include: { notification: true }, orderBy: { createdAt: 'asc' }, take: limit });
    let delivered = 0; let failed = 0;
    for (const channel of channels) {
      let smsOrganizationId: string | null = null;
      let smsCreditReserved = false;
      try {
        if (channel.type === 'SMS') {
          smsOrganizationId = channel.notification.organizationId;
          if (!smsOrganizationId) throw new Error('SMS notifications require an organization context');
          await reserveSmsCredit(smsOrganizationId);
          smsCreditReserved = true;
        }
        await deliver(channel.type, channel.address, channel.notification.title, channel.notification.message);
        await prisma.notificationChannel.update({ where: { id: channel.id }, data: { status: 'DELIVERED', deliveredAt: new Date(), errorMessage: null } }); delivered += 1;
      } catch (error) {
        if (smsCreditReserved && smsOrganizationId) {
          await prisma.organizationSmsCredit.updateMany({ where: { organizationId: smsOrganizationId, consumed: { gt: 0 } }, data: { balance: { increment: 1 }, consumed: { decrement: 1 } } }).catch(() => undefined);
        }
        await prisma.notificationChannel.update({ where: { id: channel.id }, data: { status: 'FAILED', errorMessage: (error as Error).message.slice(0, 500), retryCount: { increment: 1 } } }); failed += 1;
      }
      const grouped = await prisma.notificationChannel.groupBy({ by: ['status'], where: { notificationId: channel.notificationId }, _count: { _all: true } });
      const total = grouped.reduce((sum, row) => sum + row._count._all, 0); const statuses = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
      const status = statuses.DELIVERED === total ? 'DELIVERED' : statuses.PENDING ? 'SENT' : statuses.FAILED ? 'FAILED' : 'SENT';
      await prisma.notification.update({ where: { id: channel.notificationId }, data: { status, sentAt: new Date() } });
    }
    if (channels.length) logger.info('Notification delivery cycle completed', { processed: channels.length, delivered, failed });
    return { processed: channels.length, delivered, failed };
  },
};
