const nodemailer = require('nodemailer');

let transporter = null;

const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('🔧 Email Service: Development mode - emails will be logged');
    return {
      sendMail: async (mailOptions) => {
        console.log('\n📧 EMAIL WOULD BE SENT:');
        console.log('   To:', mailOptions.to);
        console.log('   Subject:', mailOptions.subject);
        console.log('   From:', mailOptions.from);
        if (mailOptions.html) {
          console.log('   HTML Content: [See below]');
        }
        console.log('---\n');
        return { messageId: 'dev-' + Date.now(), response: 'Development mode' };
      },
      verify: async () => true
    };
  }

  const cleanPassword = process.env.EMAIL_PASS.replace(/\s+/g, '');
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: cleanPassword,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 5,
  });
};

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

const sendEmail = async (options) => {
  const { email, subject, message } = options;
  
  if (!email) {
    console.error('Email: No recipient email provided');
    return false;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER ? `"Mission Hub" <${process.env.EMAIL_USER}>` : 'Mission Hub <noreply@missionhub.com>',
    to: email,
    subject: subject || 'Message from Mission Hub',
    html: message || '',
  };

  try {
    const transport = getTransporter();
    const info = await transport.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${email}:`, error.message);
    return false;
  }
};

// Send interview reminder email
const sendInterviewReminder = async (email, data) => {
  const subject = 'Interview Reminder - Mission Hub';
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">Interview Reminder</h2>
      <p>Hello ${data.candidateName},</p>
      <p>This is a reminder that you have an upcoming interview:</p>
      <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p><strong>Position:</strong> ${data.jobTitle}</p>
        <p><strong>Date & Time:</strong> ${data.interviewDate}</p>
        <p><strong>Type:</strong> ${data.interviewType}</p>
        ${data.meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${data.meetingLink}">${data.meetingLink}</a></p>` : ''}
        ${data.location ? `<p><strong>Location:</strong> ${data.location}</p>` : ''}
      </div>
      <p>Please make sure to prepare and join on time.</p>
      <p>Best regards,<br>Mission Hub Team</p>
    </div>
  `;
  return sendEmail({ email, subject, message });
};

// Send interview rescheduled email
const sendInterviewRescheduled = async (email, data) => {
  const subject = 'Interview Rescheduled - Mission Hub';
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7C3AED;">Interview Rescheduled</h2>
      <p>Hello ${data.candidateName},</p>
      <p>Your interview has been rescheduled:</p>
      <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p><strong>Position:</strong> ${data.jobTitle}</p>
        <p><strong>Old Date:</strong> ${data.oldDate}</p>
        <p><strong>New Date:</strong> ${data.newDate}</p>
        <p><strong>Reason:</strong> ${data.reason}</p>
      </div>
      <p>Please update your schedule accordingly.</p>
      <p>Best regards,<br>Mission Hub Team</p>
    </div>
  `;
  return sendEmail({ email, subject, message });
};

// Send interview cancelled email
const sendInterviewCancelled = async (email, data) => {
  const subject = 'Interview Cancelled - Mission Hub';
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #DC2626;">Interview Cancelled</h2>
      <p>Hello ${data.candidateName},</p>
      <p>We regret to inform you that your interview has been cancelled:</p>
      <div style="background: #FEF2F2; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p><strong>Position:</strong> ${data.jobTitle}</p>
        <p><strong>Company:</strong> ${data.companyName}</p>
        <p><strong>Original Date:</strong> ${data.date}</p>
      </div>
      <p>We apologize for any inconvenience.</p>
      <p>Best regards,<br>Mission Hub Team</p>
    </div>
  `;
  return sendEmail({ email, subject, message });
};

// Send interview completion email
const sendInterviewCompletion = async (email, data) => {
  const subject = 'Interview Completed - Mission Hub';
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10B981;">Interview Completed</h2>
      <p>Hello ${data.candidateName},</p>
      <p>Your interview has been completed. Thank you for your time!</p>
      <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p><strong>Position:</strong> ${data.jobTitle}</p>
        <p><strong>Company:</strong> ${data.companyName}</p>
        <p><strong>Interview Date:</strong> ${data.date}</p>
      </div>
      <p>We will be in touch soon with further updates.</p>
      <p>Best regards,<br>Mission Hub Team</p>
    </div>
  `;
  return sendEmail({ email, subject, message });
};

// Send application status email
const sendApplicationStatusEmail = async (email, data) => {
  const { status, applicantName, jobTitle, company, customMessage } = data;
  
  let subject = '';
  let message = '';

  switch (status) {
    case 'reviewed':
      subject = `Your Application for ${jobTitle} is Under Review`;
      message = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">
            <h2 style="color: white; margin: 0;">Application Under Review</h2>
          </div>
          <div style="padding: 20px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
            <p style="color: #333;">Dear ${applicantName},</p>
            <p style="color: #333;">Great news! Your application for the position of <strong>${jobTitle}</strong> at <strong>${company}</strong> is now being reviewed by the hiring team.</p>
            <p style="color: #666;">We will keep you updated on any further progress.</p>
            <p style="color: #666;">Best regards,<br/>The Hiring Team</p>
          </div>
        </div>
      `;
      break;
    case 'approved':
      subject = `Congratulations! Your Application for ${jobTitle} Has Been Approved!`;
      message = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 20px; border-radius: 10px 10px 0 0;">
            <h2 style="color: white; margin: 0;">Congratulations!</h2>
          </div>
          <div style="padding: 20px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
            <p style="color: #333;">Dear ${applicantName},</p>
            <p style="color: #333;">We are thrilled to inform you that your application for the position of <strong>${jobTitle}</strong> at <strong>${company}</strong> has been <strong style="color: #10B981;">APPROVED</strong>!</p>
            <p style="color: #666;">The company will reach out to you shortly with next steps.</p>
            <p style="color: #666;">Best of luck!</p>
            <p style="color: #666;">Best regards,<br/>The MissionHub Team</p>
          </div>
        </div>
      `;
      break;
    case 'rejected':
      subject = `Application Update for ${jobTitle}`;
      message = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); padding: 20px; border-radius: 10px 10px 0 0;">
            <h2 style="color: white; margin: 0;">Application Update</h2>
          </div>
          <div style="padding: 20px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
            <p style="color: #333;">Dear ${applicantName},</p>
            <p style="color: #333;">Thank you for your interest in the position of <strong>${jobTitle}</strong> at <strong>${company}</strong>.</p>
            <p style="color: #666;">After careful consideration, we have decided to proceed with other candidates whose qualifications more closely match our current needs.</p>
            <p style="color: #666;">We encourage you to apply for future positions that match your skills.</p>
            <p style="color: #666;">We wish you the best in your career journey.</p>
            <p style="color: #666;">Best regards,<br/>The MissionHub Team</p>
          </div>
        </div>
      `;
      break;
    default:
      if (customMessage) {
        subject = subject || `Update on Your Application for ${jobTitle}`;
        message = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">
              <h2 style="color: white; margin: 0;">Application Update</h2>
            </div>
            <div style="padding: 20px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
              <p style="color: #333;">Dear ${applicantName},</p>
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea;">
                ${customMessage.replace(/\n/g, '<br/>')}
              </div>
              <p style="color: #666;">Best regards,<br/>The Hiring Team</p>
            </div>
          </div>
        `;
      }
  }

  if (subject && message) {
    return sendEmail({ email, subject, message });
  }
  return false;
};

// Send new message email
const sendNewMessageEmail = async (email, data) => {
  const { senderName, subject, preview, recipientName } = data;
  
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">
        <h2 style="color: white; margin: 0;">New Message</h2>
      </div>
      <div style="padding: 20px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
        <p style="color: #333;">Hi ${recipientName},</p>
        <p style="color: #333;">You have received a new message from <strong>${senderName}</strong>.</p>
        <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea;">
          <p style="margin: 0;"><strong>Subject:</strong> ${subject || 'No Subject'}</p>
          ${preview ? `<p style="margin: 10px 0 0 0;"><strong>Message:</strong></p><p style="margin: 5px 0 0 0; color: #555;">${preview}</p>` : ''}
        </div>
        <p style="color: #666; font-size: 14px;">Log in to your MissionHub account to reply to this message.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">View Message</a>
      </div>
      <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
        This is an automated message from MissionHub. Please do not reply to this email.
      </p>
    </div>
  `;

  return sendEmail({
    email,
    subject: `New message from ${senderName} on MissionHub`,
    message
  });
};

module.exports = {
  sendEmail,
  sendInterviewReminder,
  sendInterviewRescheduled,
  sendInterviewCancelled,
  sendInterviewCompletion,
  sendApplicationStatusEmail,
  sendNewMessageEmail
};
