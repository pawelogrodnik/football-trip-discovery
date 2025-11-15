import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { SUPPORT_FORM_QUESTIONS } from 'lib/supportFormQuestions';

const DEFAULT_RECIPIENT = 'mkpawell@gmail.com';

type SupportPayload = {
  name?: string;
  email?: string;
  subject?: string | null;
  message: string;
  type: 'contact' | 'bug';
  securityAnswer?: string;
  questionId?: number;
  website?: string; // honeypot field
};

const suspiciousAgents = ['curl', 'wget', 'spider', 'bot', 'headless', 'httpclient', 'postman'];

function isSuspiciousUserAgent(userAgent: string | null) {
  if (!userAgent || userAgent.length < 10) {
    return true;
  }
  const lower = userAgent.toLowerCase();
  return suspiciousAgents.some((agent) => lower.includes(agent));
}

const sanitizeText = (value: string | undefined | null) => value?.toString().trim() ?? '';

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = process.env.SMTP_SECURE !== 'false';

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

const transporter = buildTransporter();

export async function POST(req: Request) {
  let payload: SupportPayload;
  try {
    payload = (await req.json()) as SupportPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (payload.website) {
    return NextResponse.json({ error: 'Bot detected' }, { status: 400 });
  }

  const userAgent = req.headers.get('user-agent');
  if (isSuspiciousUserAgent(userAgent)) {
    return NextResponse.json({ error: 'Suspicious request blocked' }, { status: 400 });
  }

  const name = sanitizeText(payload.name) || 'Anonymous';
  const email = sanitizeText(payload.email);
  const subject = sanitizeText(payload.subject);
  const message = sanitizeText(payload.message);
  const type = payload.type;

  if (!message || message.length < 5 || (type !== 'contact' && type !== 'bug')) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (message.length > 5000) {
    return NextResponse.json({ error: 'Message is too long' }, { status: 400 });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email address looks invalid' }, { status: 400 });
  }

  const questionId = Number(payload.questionId);
  const question = SUPPORT_FORM_QUESTIONS[Number.isFinite(questionId) ? questionId : -1];

  const normalizedAnswer = sanitizeText(payload.securityAnswer).toLowerCase();
  const expectedAnswer = question?.answer?.toLowerCase().trim();

  if (!question || !expectedAnswer || normalizedAnswer !== expectedAnswer) {
    return NextResponse.json(
      {
        error: 'Human verification failed',
      },
      { status: 400 }
    );
  }

  const recipient = process.env.SUPPORT_RECIPIENT ?? DEFAULT_RECIPIENT;
  const emailSubject = `[${type === 'bug' ? 'Bug Report' : 'Contact'}] ${subject || 'New message'}`;

  const textBody = [
    `Type: ${type}`,
    `Name: ${name}`,
    email ? `Email: ${email}` : null,
    `User-Agent: ${userAgent ?? 'unknown'}`,
    subject ? `Subject: ${subject}` : null,
    '',
    message,
  ]
    .filter(Boolean)
    .join('\n');

  if (!transporter) {
    console.warn('[support] Email transport not configured. Message contents:\n', textBody);
    return NextResponse.json(
      { success: true, warning: 'Email transport not configured on server.' },
      { status: 200 }
    );
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: recipient,
      replyTo: email || undefined,
      subject: emailSubject,
      text: textBody,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[support] Failed to send email', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
