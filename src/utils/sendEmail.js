import nodemailer from "nodemailer";
import dotenv from 'dotenv';
dotenv.config();

const sendEmail = async (options) => {
    const username = process.env.SMTP_EMAIL;
    const password = process.env.SMTP_PASSWORD;

    if (!username || !password) {
        throw new Error('SMTP_EMAIL and SMTP_PASSWORD must be configured');
    }

    const transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
            user: username,
            pass: password,
        },
    });

    const mailOptions = {
        from: `Puja Booking App <${username}>`,
        to: options.email,
        subject: options.subject,
        html: options.html,
    };

    await transporter.sendMail(mailOptions);    
};

export default sendEmail;