const nodemailer = require("nodemailer");

function randomMailContent() {
        const subjects = [
                "Weekend plans?",
                "Quick status update",
                "Idea for the project",
                "Coffee later?"
        ];
        const bodies = [
                `Hey there,

Just checking if you got the doc I sent yesterday.

Cheers,
Mail Test Bot`,
                `Hello,

I stumbled upon an article that could help with our current sprint.

Regards,
Mail Test Bot`,
                `Hi,

Let me know if we are still on for the evening sync.

Thanks,
Mail Test Bot`,
                `Yo,

Found a bug in the latest build—pushing a fix soon.

Later,
Mail Test Bot`
        ];
        const idx = Math.floor(Math.random() * subjects.length);
        return { subject: subjects[idx], text: bodies[idx] };
}

async function testSMTP() {
        const transporter = nodemailer.createTransport({
                host: "localhost",
                port: 25,
                secure: false,
                tls: { rejectUnauthorized: false },
        });

        const { subject, text } = randomMailContent();
        const info = await transporter.sendMail({
                from: '"parminder singh" <parminder@kosh.com>',
                to: "yesask8@rajdoot.wtf",
                subject,
                text,
        });

        console.log("Message sent:", info.messageId);
}

testSMTP().catch(console.error);
