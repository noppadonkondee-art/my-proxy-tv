// ไฟล์: api/index.js
// ต้องสั่ง npm install axios https-proxy-agent ในโปรเจกต์ก่อนนะครับ

const { HttpsProxyAgent } = require('https-proxy-agent');
const axios = require('axios');

// ==========================================
// 🟢 ใส่ข้อมูล Proxy ของคุณให้เรียบร้อยแล้วครับ
// ==========================================
const PROXY_URL = 'http://lhbppjyi:picfrt2w3db3@31.59.20.176:6754';
const agent = new HttpsProxyAgent(PROXY_URL);

// ตั้งค่า Header เพื่อหลอกเว็บต้นทาง (otttv.pw)
const FAKE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    // ใส่ Referer กันเหนียวไว้ เผื่อเขาเช็ค
    "Referer": "http://6zirt9yx.otttv.pw/", 
    "Origin": "http://6zirt9yx.otttv.pw"
};

export default async function handler(req, res) {
    // รับลิงค์วีดีโอจาก Parameter '?url='
    const { url } = req.query;

    if (!url) {
        return res.status(400).send("Error: Please provide ?url=http://...");
    }

    try {
        // 1. สั่งดึงข้อมูลโดยวิ่งผ่าน Proxy ที่คุณให้มา
        const response = await axios.get(url, {
            httpsAgent: agent,
            httpAgent: agent,
            headers: FAKE_HEADERS,
            responseType: 'arraybuffer' // รับมาแบบดิบๆ (เพื่อรองรับทั้งไฟล์ Text และ Video)
        });

        // URL ของ Server Vercel ของเรา (เพื่อใช้เปลี่ยนลิงค์)
        const myHost = `https://${req.headers.host}/api/index?url=`;

        // ตรวจสอบว่าเป็นไฟล์ M3U8 (Playlist) หรือไม่
        const contentType = response.headers['content-type'];
        const isM3U8 = url.includes('.m3u8') || (contentType && contentType.includes('mpegurl'));

        if (isM3U8) {
            // --- กรณีเป็นไฟล์ Playlist (.m3u8) ---
            // เราต้องอ่านไส้ใน แล้วแก้ลิงค์ข้างในให้วิ่งผ่านเรา
            let text = response.data.toString('utf-8');
            const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

            // ใช้ Regex ค้นหาบรรทัดที่เป็นลิงค์ แล้วแก้ให้วิ่งผ่าน proxy เรา
            const modifiedText = text.replace(/^(?!#)(?!\s)(.*)$/mg, (match) => {
                match = match.trim();
                if (!match) return match;

                if (match.startsWith('http')) {
                    // ถ้าเป็นลิงค์เต็ม (http://...)
                    return `${myHost}${encodeURIComponent(match)}`;
                } else {
                    // ถ้าเป็นลิงค์ย่อ (file.ts) เอา baseUrl มาต่อก่อน
                    return `${myHost}${encodeURIComponent(baseUrl + match)}`;
                }
            });

            // ส่งข้อมูลที่แก้แล้วกลับไป
            res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(modifiedText);

        } else {
            // --- กรณีเป็นไฟล์ Video Segment (.ts) ---
            // ส่งต่อข้อมูลวีดีโอไปเลย ไม่ต้องแก้
            res.setHeader("Content-Type", "video/mp2t");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(response.data);
        }

    } catch (error) {
        console.error("Proxy Error:", error.message);
        res.status(500).send(`Proxy Error: ${error.message}`);
    }
}