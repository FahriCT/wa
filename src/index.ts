import express, { Request, Response } from "express";
import axios from "axios";
import { Client, Message, MessageMedia } from "whatsapp-web.js";
import { GoogleGenerativeAI, ChatSession } from "@google/generative-ai";
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.API_KEY!);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = 5000;

async function mediaToGenerativePart(media: MessageMedia) {
  return {
    inlineData: { data: media.data, mimeType: media.mimetype },
  };
}

// Konfigurasi WhatsApp client dengan pairing code
const whatsappClient = new Client({
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

// Fungsi untuk melakukan pairing dengan kode
async function pairWithCode() {
    try {
        // Ganti dengan nomor telepon Anda (format: countrycode+number)
        const phoneNumber = "6287716241872"; // Contoh: 628123456789
        const code = await whatsappClient.requestPairingCode(phoneNumber);
        console.log(`Pairing code: ${code}`);
        console.log("Masukkan kode ini di WhatsApp mobile Anda");
    } catch (error) {
        console.error("Error saat meminta pairing code:", error);
    }
}

whatsappClient.on("ready", () => {
    console.log("WhatsApp Web client is ready!");
});

whatsappClient.on("message", async (msg: Message) => {
    const senderNumber: string = msg.from;
    const message: string = msg.body;

    console.log(`Received message from ${senderNumber}: ${message}`);

    let mediaPart = null;

    if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        mediaPart = await mediaToGenerativePart(media);
    }

    await run(message, senderNumber, mediaPart);
});

// Inisialisasi client dan mulai proses pairing
whatsappClient.initialize().then(() => {
    pairWithCode();
}).catch(err => {
    console.error("Error during initialization:", err);
});

let chat: ChatSession | null = null;

async function run(message: string, senderNumber: string, mediaPart?: any): Promise<void> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        if (!chat) {
            chat = model.startChat({
                generationConfig: {
                    maxOutputTokens: 500,
                },
            });
        }
        let prompt: any[] = [];

        prompt.push(message);

        if (mediaPart) {
            prompt.push(mediaPart);
        }
        
        const result = await chat.sendMessage(prompt);
        const response = await result.response;
        const text: string = response.text();

        if (text) {
            console.log("Generated Text:", text);
            await sendWhatsAppMessage(text, senderNumber);
        } else {
            console.error("This problem is related to Model Limitations and API Rate Limits");
        }

    } catch (error) {
        console.error("Error in run function:", error);
        await sendWhatsAppMessage("Oops, an error occurred. Please try again later.", senderNumber);
    }
}

async function sendWhatsAppMessage(text: string, toNumber: string): Promise<void> {
    try {
        await whatsappClient.sendMessage(toNumber, text);
    } catch (err) {
        console.error("Failed to send WhatsApp message:");
        console.error("Error details:", err);
    }
}

app.listen(port, () => console.log(`Express app running on port ${port}!`));
