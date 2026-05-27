import nodemailer from "nodemailer";

/**
 * Sends a verification email with a token link to the user.
 * If SMTP environment variables are missing, it logs the link to the console for development.
 * 
 * @param {string} toEmail - The recipient's email address
 * @param {string} token - The raw verification token
 */
export const sendVerificationEmail = async (toEmail, token) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const verificationLink = `${frontendUrl}/verify-email?token=${token}`;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || `"OrbitIDE" <noreply@orbitide.dev>`;

  // Fallback to console logging if SMTP credentials are not configured
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log("\n====================================================================");
    console.log("📨 [EMAIL SERVICE - DEVELOPMENT FALLBACK]");
    console.log(`To: ${toEmail}`);
    console.log(`Subject: Verify your OrbitIDE Account`);
    console.log(`Verification Link: ${verificationLink}`);
    console.log("====================================================================\n");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: parseInt(smtpPort) === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const mailOptions = {
      from: smtpFrom,
      to: toEmail,
      subject: "Verify your OrbitIDE Account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #3b82f6; text-align: center;">Welcome to OrbitIDE!</h2>
          <p>Hi there,</p>
          <p>Thank you for signing up for OrbitIDE. Please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
          </div>
          <p>This verification link will expire in 24 hours.</p>
          <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
          <p style="word-break: break-all; color: #64748b;">${verificationLink}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">If you did not request this email, please ignore it.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📨 Verification email successfully sent to ${toEmail}`);
  } catch (error) {
    console.error("❌ Failed to send verification email:", error);
    // Even if it fails, log the link in development so the developer is not blocked
    if (process.env.NODE_ENV === "development") {
      console.log(`\n[DEV BACKUP] Verification Link: ${verificationLink}\n`);
    }
    throw new Error("Could not send verification email. Please try again later.");
  }
};
