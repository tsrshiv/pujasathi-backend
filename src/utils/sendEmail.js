import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const sendEmail = async (options) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;

    if (apiKey && from) {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to: [options.email],
                subject: options.subject,
                html: options.html,
            }),
        });

        const responseBody = await response.json();
        if (!response.ok) {
            throw new Error(`Resend email request failed (${response.status}): ${responseBody.message || responseBody.name || 'Unknown provider error'}`);
        }

        return responseBody;
    }

    const username = process.env.SMTP_EMAIL;
    const password = process.env.SMTP_PASSWORD;
    if (!username || !password) {
        throw new Error('Configure RESEND_API_KEY and RESEND_FROM_EMAIL, or SMTP_EMAIL and SMTP_PASSWORD');
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: username, pass: password },
    });

    return transporter.sendMail({
        from: `Puja Booking App <${username}>`,
        to: options.email,
        subject: options.subject,
        html: options.html,
    });
};

export default sendEmail;