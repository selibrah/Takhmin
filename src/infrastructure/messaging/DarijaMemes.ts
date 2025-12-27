// Moroccan Darija Meme Library with Dark Humor & Sarcasm

export const DarijaMemes = {
    // Failed Predictions
    failedPrediction: [
        "Mat lik l7ot! مات ليك الحوت 🐟💀", // Your fish died
        "Ja yke77elha 3maha! جا يكحلها عماها 😂", // Tried to help but made it worse  
        "Galek l'7out taytir! قالك الحوت كيطير ✈️", // Someone told you fish flies
        "Wach nta Google? 7it 3andek jawb 3la kolshi! واش نتا كوكل؟ 🤓", // Are you Google?
        "Kolchi gal 3lik nta galt la! كلشي قال عليك نتا قلت لا 🤡",
    ],

    // Wrong Result (Lost Points)
    wrongResult: [
        "Zit 3la zit! زيت على زيت 🛢️", // From bad to worse
        "Lmosh li ma ywsel l 7outa ygoul 3liha 5anza 🐱🐟", // Sour grapes
        "3ando flous l-7anut w kaytshari l-karossa! عندو فلوس الحانوت 🛒",
        "Khsara fik a sat! خسارة فيك 💔",
    ],

    // Winners (Barely Survived)
    winner: [
        "Nta o zahrak! أنت و زهرك 🍀 (باقي حي بالحظ)",
        "Li fatek b lila fatek b 7ila... ليفاتك بليلة 😏",
        "Rah ghir l7ad! راه غير الحظ، ماشي العقل 🎲",
    ],

    // Match Announcement
    matchAnnouncement: [
        "Mabrouk! صباح الخير... اليوم عندكم فرصة تخسرو نقط جداد! 🎊",
        "Yallah prepare iw9a3 flous! يالاه حضرو الفلوس 💰",
        "Lyoum nchofkom chkoun ghadi ytayeb predictions! اليوم نشوفكم 👀",
    ],

    // Lock Notification
    lockNotification: [
        "L7abs tfermet! الحبس تفرمت 🔒 Predictions dyalkom wlaw m7absa!",
        "Ma b9ach wakt! ما بقاش الوقت ⏰ Chofna chkoun ghadi ybki!",
    ],

    // No Prediction Warning  
    noPrediction: [
        "Ma dar walo o kaytsena i rbeh! ما دار والو 😴",
        "Khasek tdir prediction wla ghir tjless tfrrj? خاصك تدير 🤔",
    ],

    // Lock warnings (15m before kickoff)
    lock: [
        "L7abs tfermet! الحابس تفرمت! 🔒",
        "3ad ma b9ash wakt! عاد ما بقاش وقت! ⏰",
        "Predictions dyawlk wlaw m7absa! 🔐",
    ],

    // Result not submitted (Admin reminder)
    noResult: [
        "Wla nsa likom? ولا نساه ليكوم؟ 🤔",
        "Finek a Admin? فينك Admin?",
        "Dir result wla ma3andekch internet? 📡",
    ]
};

export function getRandomMeme(category: keyof typeof DarijaMemes): string {
    const memes = DarijaMemes[category];
    return memes[Math.floor(Math.random() * memes.length)];
}

export function getContextualMeme(category: keyof typeof DarijaMemes, playerName?: string): string {
    let meme = getRandomMeme(category);
    if (playerName) {
        meme = `${playerName}: ${meme}`;
    }
    return meme;
}
