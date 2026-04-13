const nodemailer = require('nodemailer');

let transporter = null;

const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('📧 Gmail: Configuration missing - emails will be logged to console');
    return {
      sendMail: async (mailOptions) => {
        console.log('\n📧 Email would be sent:');
        console.log('   To:', mailOptions.to);
        console.log('   Subject:', mailOptions.subject);
        console.log('   HTML:', mailOptions.html?.substring(0, 100) + '...');
        return { messageId: 'dev-' + Date.now() };
      }
    };
  }

  // Create Gmail transporter
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  return transporter;
};

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

const LOGO_URL = process.env.EMAIL_LOGO_URL || 'https://missionhub.example.com/logo.png';
const PRIMARY_COLOR = '#4F46E5';
const SECONDARY_COLOR = '#7C3AED';
const BG_COLOR = '#F9FAFB';
const TEXT_COLOR = '#1F2937';
const TEXT_LIGHT = '#6B7280';

const emailWrapper = (content, accentColor = PRIMARY_COLOR) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MissionHub</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${BG_COLOR};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${BG_COLOR};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 20px rgba(0, 0, 0, 0.03); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${SECONDARY_COLOR} 100%); padding: 32px 40px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="text-align: center;">
                    <img src="https://i.imgur.com/MissionHubLogo.png" alt="MissionHub" width="180" height="45" style="display: inline-block; margin-bottom: 16px;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, ${accentColor}, ${SECONDARY_COLOR});"></td>
          </tr>
          <tr>
            <td style="padding: 40px; color: ${TEXT_COLOR};">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background-color: ${BG_COLOR}; padding: 20px 40px; text-align: center; border-top: 1px solid ${BORDER_COLOR};">
              <p style="margin: 0; color: ${TEXT_LIGHT}; font-size: 12px;">&copy; ${new Date().getFullYear()} MissionHub. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const infoBox = (items) => `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
  ${items.map(item => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid ${BORDER_COLOR};">
        <span style="color: ${TEXT_LIGHT}; font-size: 14px;">${item.label}:</span>
        <span style="color: ${TEXT_COLOR}; font-size: 14px; font-weight: 600; margin-left: 8px;">${item.value}</span>
      </td>
    </tr>
  `).join('')}
</table>
`;

const ctaButton = (text, url) => `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
  <tr>
    <td align="center">
      <a href="${url}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${SECONDARY_COLOR} 100%); color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px;">${text}</a>
    </td>
  </tr>
</table>
`;

const sendEmail = async (options) => {
  const { email, subject, message } = options;
  
  if (!email) {
    console.error('Email: No recipient email provided');
    return false;
  }

  try {
    const transport = getTransporter();
    const htmlContent = message || '';
    
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'MissionHub <noreply@missionhub.com>',
      to: email,
      subject: subject || 'Message from MissionHub',
      html: htmlContent
    });

    console.log(`✅ Email sent successfully to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${email}:`, error.message);
    return false;
  }
};

// Verify transporter connection
const verifyConnection = async () => {
  try {
    const transport = getTransporter();
    await transport.verify();
    console.log('✅ Gmail SMTP connection verified');
    return true;
  } catch (error) {
    console.error('❌ Gmail SMTP connection failed:', error.message);
    return false;
  }
};

module.exports = {
  sendEmail,
  emailWrapper,
  infoBox,
  ctaButton,
  verifyConnection,
  createTransporter,
  getTransporter
};