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

const COLORS = {
  primary: '#0f172a',
  primaryDark: '#1e293b',
  accent: '#f59e0b',
  accentLight: '#fbbf24',
  bg: '#f8fafc',
  cardBg: '#ffffff',
  text: '#1e293b',
  textLight: '#64748b',
  border: '#e2e8f0',
  success: '#10b981',
  error: '#ef4444',
};

const emailWrapper = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MissionHub</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: ${COLORS.bg};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${COLORS.bg};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: ${COLORS.cardBg}; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 20px rgba(0, 0, 0, 0.03); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%); padding: 36px 40px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: ${COLORS.accent}; border-radius: 14px; margin-bottom: 12px;">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 7L12 3L4 7V17L12 21L20 17V7Z" stroke="${COLORS.primary}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 12L20 7M12 12V21M12 12L4 7" stroke="${COLORS.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <br/>
                    <span style="font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Mission<span style="color: ${COLORS.accent}">Hub</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentLight});"></td>
          </tr>
          <tr>
            <td style="padding: 40px 32px; color: ${COLORS.text};">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; text-align: center; color: ${COLORS.textLight}; font-size: 13px; border-top: 1px solid ${COLORS.border};">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} MissionHub. All rights reserved.</p>
              <p style="margin: 8px 0 0; font-size: 12px;">Connecting talent with opportunity</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const infoBox = (items) => `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0; background: ${COLORS.bg}; border-radius: 12px; border: 1px solid ${COLORS.border};">
${items.map((item, i) => `
<tr>
  <td style="padding: 14px 20px; ${i < items.length - 1 ? `border-bottom: 1px solid ${COLORS.border};` : ''}">
    <span style="color: ${COLORS.textLight}; font-size: 13px; font-weight: 500;">${item.label}:</span>
    <span style="color: ${COLORS.text}; font-size: 14px; font-weight: 600; margin-left: 8px;">${item.value}</span>
  </td>
</tr>
`).join('')}
</table>`;

const ctaButton = (text, url) => `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
  <tr>
    <td align="center">
      <a href="${url}" style="display: inline-flex; align-items: center; justify-content: center; padding: 14px 28px; background: ${COLORS.primary}; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 10px;">${text}</a>
    </td>
  </tr>
</table>`;

const badge = (text, color = COLORS.accent) => `
<span style="display: inline-block; padding: 4px 12px; background: ${color}; color: ${COLORS.primary}; font-size: 12px; font-weight: 600; border-radius: 20px;">${text}</span>
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
    
    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('\n📧 Email (mock - no credentials configured):');
      console.log('   From: MissionHub');
      console.log('   To:', email);
      console.log('   Subject:', subject ? `MissionHub - ${subject}` : 'Message from MissionHub');
      console.log('   Status: Would be sent if EMAIL_USER & EMAIL_PASS configured');
      return true; // Return true to not block the process
    }
    
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || 'MissionHub <noreply@missionhub.com>',
      to: email,
      subject: subject ? `MissionHub - ${subject}` : 'Message from MissionHub',
      html: htmlContent
    });

    console.log(`✅ Email sent successfully to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${email}:`, error.message);
    return false;
  }
};

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
  badge,
  verifyConnection,
  createTransporter,
  getTransporter,
  COLORS
};