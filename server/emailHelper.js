// emailHelper.js
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendSessionEmail = async ({ to, subject, text }) => {
  try {
    await transporter.sendMail({
      from: `"Chrysalise" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error("Email sending error:", error);
  }
};

export const sendResetPasswordEmail = async ({ to, firstName, resetToken }) => {
  try {
    await transporter.sendMail({
      from: `"Chrysalise" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Reset your password",
      text: `Hi ${firstName ?? "there"},\n\nYour password reset token is:\n\n${resetToken}\n\nSend it to POST /reset-password with your new password.\nThis token expires in 1 hour.\n\nIf you did not request this, ignore this email.`,
    });
  } catch (error) {
    console.error("Email sending error:", error);
  }
};