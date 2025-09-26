/* Créditos A Quien Correspondan 
   TikTok Downloader Adaptado 
   Por Cuervo-Team-Supreme & P_I_K_O */

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const util = require("util");
const { exec } = require("child_process");
const execPromise = util.promisify(exec);

// Helper: richer diagnostics for axios/network errors
function logAxiosError(prefix, error) {
	try {
		const status = error?.response?.status;
		const statusText = error?.response?.statusText;
		const url = error?.config?.url;
		const method = error?.config?.method;
		const headers = error?.response?.headers;
		const dataPreview = (() => {
			if (!error?.response?.data) return undefined;
			if (Buffer.isBuffer(error.response.data)) return `<buffer ${error.response.data.length} bytes>`;
			const str = typeof error.response.data === "string" ? error.response.data : JSON.stringify(error.response.data);
			return str.slice(0, 500);
		})();
		console.error(`[${prefix}] AxiosError:`, {
			message: error?.message,
			code: error?.code,
			url,
			method,
			status,
			statusText,
			headers,
			dataPreview,
		});
	} catch (e) {
		console.error(`[${prefix}] Failed to log axios error`, e);
	}
}

// TikTok API wrapper
const tiktokApi = {
	base: "https://tikwm.com/api",
	async fetchMeta(url) {
		try {
			const apiUrl = `${this.base}/?url=${encodeURIComponent(url)}`;
			const { data } = await axios.get(apiUrl, {
				timeout: 20000,
				headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
			});
			if (!data || data.code !== 0 || !data.data) {
				throw new Error("Invalid response from TikWM API");
			}
			return { status: true, result: data.data };
		} catch (err) {
			if (err?.isAxiosError) logAxiosError("TIKTOK.api", err);
			throw err;
		}
	},
};

async function tiktokCommand(sock, chatId, message) {
	try {
		const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
		const input = text.split(" ").slice(1).join(" ").trim();

		if (!input) {
			return await sock.sendMessage(chatId, { text: "🎥 Provide a TikTok video link or ID." }, { quoted: message });
		}

		// Fetch metadata
		let meta;
		try {
			meta = await tiktokApi.fetchMeta(input);
		} catch (err) {
			return await sock.sendMessage(chatId, { text: "❌ Failed to fetch video. Make sure the link is correct." }, { quoted: message });
		}

		const d = meta.result;
		const title = d.title || "TikTok Video";
		const author = d.author?.nickname || d.author?.unique_id || "Unknown";
		const thumbnail = d.cover || d.origin_cover || "";
		const desc = `*💜PIKO TIKTOK DOWNLOADER💜*

👤 *Author*: ${author}
📝 *Title*: ${title}

🔗 *Video Link*: ${input}

𝐌𝐚𝐝𝐞 𝐛𝐲 *_PIKO_* ☯️`;

		// Send metadata & thumbnail
		if (thumbnail) {
			await sock.sendMessage(chatId, { image: { url: thumbnail }, caption: desc }, { quoted: message });
		} else {
			await sock.sendMessage(chatId, { text: desc }, { quoted: message });
		}

		// Slideshow support
		if (Array.isArray(d.images) && d.images.length > 0) {
			for (let i = 0; i < d.images.length; i++) {
				await sock.sendMessage(
					chatId,
					{
						image: { url: d.images[i] },
						caption: i === 0 ? `📮 *TikTok Slideshow*\n${d.images.length} photos\n\n𝐌𝐚𝐝𝐞 𝐛𝐲 *_PIKO_* ☯️` : undefined,
					},
					{ quoted: message }
				);
			}
			if (d.music) {
				await sock.sendMessage(
					chatId,
					{
						audio: { url: d.music },
						mimetype: "audio/mp4",
						caption: `🎵 *Audio from slideshow*\n\n𝐌𝐚𝐝𝐞 𝐛𝐲 *_PIKO_* ☯️`,
					},
					{ quoted: message }
				);
			}
			return await sock.sendMessage(chatId, { text: "*Sent TikTok Slideshow Images!* 🧧" }, { quoted: message });
		}

		// Video support
		const videoUrl = d.play;
		if (!videoUrl) {
			return await sock.sendMessage(chatId, { text: "❌ No video or slideshow found for this link." }, { quoted: message });
		}

		const tempDir = path.join(__dirname, "../temp");
		if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
		const tempFile = path.join(tempDir, `${Date.now()}.mp4`);

		try {
			const response = await axios({
				url: videoUrl,
				method: "GET",
				responseType: "stream",
				timeout: 30000,
				maxRedirects: 5,
			});

			await new Promise((resolve, reject) => {
				const writer = fs.createWriteStream(tempFile);
				response.data.pipe(writer);
				writer.on("finish", resolve);
				writer.on("error", reject);
			});
		} catch (err) {
			logAxiosError("TIKTOK.videoDownload", err);
			return await sock.sendMessage(chatId, { text: "Failed to download TikTok video." }, { quoted: message });
		}

		await sock.sendMessage(
			chatId,
			{
				video: { url: tempFile },
				caption: `☮️ *${title}*\n\n𝐌𝐚𝐝𝐞 𝐛𝐲 *_PIKO_* ☯️`,
			},
			{ quoted: message }
		);

		setTimeout(() => {
			try {
				if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
			} catch {}
		}, 2000);

		await sock.sendMessage(chatId, { text: "*Thanks for using my bot!* 💙" }, { quoted: message });
	} catch (error) {
		console.error(`[TIKTOK] General error:`, error);
		await sock.sendMessage(chatId, { text: "Download failed. Please try again later." }, { quoted: message });
	}
}

module.exports = tiktokCommand;
