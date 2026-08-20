import nodemailer from "nodemailer";
import { env } from "@/config/env";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
});

function wrapTemplate(title: string, bodyHtml: string, ctaLabel: string, ctaUrl: string) {
  return `
  <div style="background:#09090B;padding:40px 20px;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#121212;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
      <div style="display:inline-block;width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#7C3AED,#06B6D4);margin-bottom:20px;"></div>
      <h1 style="color:#fff;font-size:20px;margin:0 0 12px;">${title}</h1>
      <div style="color:#A1A1AA;font-size:14px;line-height:1.6;">${bodyHtml}</div>
      <a href="${ctaUrl}" style="display:inline-block;margin-top:24px;padding:12px 24px;border-radius:10px;background:linear-gradient(135deg,#7C3AED,#06B6D4);color:#fff;text-decoration:none;font-weight:600;font-size:14px;">${ctaLabel}</a>
      <p style="color:#71717A;font-size:12px;margin-top:24px;">If the button doesn't work, copy this link:<br/>${ctaUrl}</p>
      <p style="color:#71717A;font-size:12px;margin-top:16px;">— NexPlay · Play • Compete • Earn</p>
    </div>
  </div>`;
}

export const emailService = {
  async sendVerificationEmail(to: string, username: string, verifyUrl: string) {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject: "Verify your NexPlay account",
      html: wrapTemplate(
        `Welcome to NexPlay, ${username}`,
        "Confirm your email address to activate your account and start competing.",
        "Verify Email",
        verifyUrl
      ),
    });
  },

  async sendPasswordResetEmail(to: string, username: string, resetUrl: string) {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject: "Reset your NexPlay password",
      html: wrapTemplate(
        `Hi ${username}, reset your password`,
        "We received a request to reset your password. This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.",
        "Reset Password",
        resetUrl
      ),
    });
  },

  async sendAccountLockedEmail(to: string, username: string, supportUrl: string) {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject: "Your NexPlay account was temporarily locked",
      html: wrapTemplate(
        `Hi ${username}, we locked your account`,
        "Too many failed login attempts were detected. Your account has been temporarily locked to protect it. It will unlock automatically, or you can reset your password now.",
        "Reset Password",
        supportUrl
      ),
    });
  },
};
