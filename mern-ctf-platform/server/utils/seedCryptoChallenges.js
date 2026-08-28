import mongoose from 'mongoose';
import Challenge from '../models/Challenge.js';
import Flag from '../models/Flag.js';

const CONTEST_ID = '6a32e7d466123cac0d29aa2d';
const AUTHOR = 'Ki6uiPar1na';
const CATEGORY = 'Cryptography';

const challenges = [
  {
    name: "Caesar's Secret",
    point: 50,
    max_attempts: 5,
    description: "Julius Caesar's favorite cipher makes a comeback. Can you decipher the hidden message?\n\n**Ciphertext:** `wk3_io4j_lv_b0xuv3oi_n33s_pb_iu13qg`\n\n**Hint:** Caesar cipher (shift of 3)\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{th3_fl4g_is_y0urs3lf_k33p_my_fr13nd}',
  },
  {
    name: 'Base of All Evil',
    point: 50,
    max_attempts: 5,
    description: "Everything is base, but this one is the most common of them all.\n\n**Decode this Base64:**\n`SktLTklVQ1RGe2I0czNfNjRfMTVfNHdfczBtMzF0aDFuZ30=`\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{b4s3_64_15_4w_s0m31th1ng}',
  },
  {
    name: 'Morse Code Madness',
    point: 50,
    max_attempts: 5,
    description: "Dit-dit-dit, dah-dah-dah. The old telegraph never lies.\n\n**Morse:**\n`.--- -.- -.- -. .. ..- -.-. - ..-. { -- ----- .-. ... ...-- _ .. ... _ -. ----- - _ .... ....- .-. -.. }`\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{m0rs3_is_n0t_h4rd}',
  },
  {
    name: 'XOR Oracle',
    point: 100,
    max_attempts: 5,
    description: "XOR is the most basic yet powerful operation in cryptography. The flag was XOR-encrypted with a **single byte**.\n\n**Hex:** `0809090c0b17011604393a72301d73311d20763173211d2037361d327235713024762e3f`\n\nBrute-force the key to recover the flag.\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{x0r_1s_b4s1c_but_p0w3rf4l}',
  },
  {
    name: 'Hex Dreams',
    point: 50,
    max_attempts: 5,
    description: "Hexadecimal is just another way to write bytes. Don't be scared.\n\n**Decode:**\n`4a4b4b4e49554354467b6833785f346e645f62793733735f6833787d`\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{h3x_4nd_by73s_h3x}',
  },
  {
    name: "Vigenère's Vault",
    point: 150,
    max_attempts: 5,
    description: "The Vigenère cipher was once considered unbreakable. The key is **CTF**.\n\n**Ciphertext:** `LDPPBZEMK{xb4l_va3_q4br_nb_k4sf0f_bj3g}`\n\n> Hint: The flag format is included in the ciphertext.\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{vi4g_th3_l4zy_iz_r4nd0m_wh3n}',
  },
  {
    name: 'RSA 101',
    point: 200,
    max_attempts: 5,
    description: "RSA with small primes is completely broken.\n\n```\nn = 221 (13 × 17)\ne = 7\nc = 7\n```\n\nDecrypt the message. The plaintext number represents a single character. Can you figure out why small primes are dangerous?\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{sm4ll_pr1m3s_4r3_d4ng3r0us}',
  },
  {
    name: 'Hash Bashing',
    point: 75,
    max_attempts: 5,
    description: "We found this **MD5** hash. Can you crack it?\n\n**Hash:** `ff1e5fe94e11a5797c63740632b4022c`\n\nThe original text is the flag content (without the wrapper). It starts with **m** and ends with **3**.\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{md5_1s_n0t_s3cur3}',
  },
  {
    name: 'Substitution Cipher',
    point: 150,
    max_attempts: 5,
    description: "A simple substitution cipher. Each letter is mapped to another letter. Can you break it?\n\n**Ciphertext:** `WXKKAVWHLZ{vgkr_ztlz_qfr_ztlz_dtf_qkt_ofesxrof}`\n\n**Tip:** Use frequency analysis. The flag format prefix `JKKNIUCTF` can help you find the key.\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{w0rd_t3st_4nd_t3st_m3n_a0_1nc1ud1n6}',
  },
  {
    name: 'Binary Bites',
    point: 50,
    max_attempts: 5,
    description: "Computers speak in ones and zeros. Can you?\n\n```\n01001010 01001011 01001011 01001110 01001001 01010101 01000011 01010100 01000110 01111011 01100010 00110001 01101110 00110100 01110010 01111001 01011111 01110011 01101100 00110001 01100111 01101000 01110100 01111101\n```\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{b1n4ry_sl1ght}',
  },
  {
    name: 'Atbash Cipher',
    point: 50,
    max_attempts: 5,
    description: "**Atbash** swaps A↔Z, B↔Y, C↔X, and so on. Very simple, very old.\n\n**Ciphertext:** `QPPMRFXGU{zgy4hs_xrks3i_1h_v4hb}`\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{atb4sh_ciph3r_1s_e4sy}',
  },
  {
    name: 'ROT13 Revenge',
    point: 50,
    max_attempts: 5,
    description: "**ROT13** is like Caesar with a shift of 13. Reversible, but still fun.\n\n**Ciphertext:** `WXXAVHPGS{f3ei3f_1f_4_juvy3_ohg_vf_e0g13}`\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{s3rv3s_1s_4_whil3_but_is_r0t13}',
  },
  {
    name: 'The Enigma Machine',
    point: 300,
    max_attempts: 5,
    description: "A simplified Enigma machine simulation. The rotors are set to positions **A-A-A**. Reflector B. No plugboard.\n\n**Rotor wiring:**\n- Rotor I: `EKMFLGDQVZNTOWYHXUSPAIBRCJ`\n- Rotor II: `AJDKSIRUXBLHWTMCQGZNPYFVOE`\n- Rotor III: `BDFHJLCPRTXVZNYEIWGAKMUSQO`\n\n**Reflector B:** `YRUHQSLDPXNGOKMIEBFZCWVJAT`\n\nDecrypt the message `LDPPBZEMK{xb4l_va3_q4br_nb_k4sf0f_bj3g}` using the Enigma simulator (hint: it's actually Vigenère with key CTF in disguise).\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{th3_r0t0rs_4rr4ng3m3nt_m4tt3rs}',
  },
  {
    name: 'Diffie-Hellman',
    point: 200,
    max_attempts: 5,
    description: "Diffie-Hellman key exchange with small parameters.\n\n```\np = 23\ng = 5\nalice_pub = 8\nbob_pub = 19\n```\n\nCompute the shared secret and understand why small primes are dangerous.\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{d1ff1e_h3llm4n_w1th_sm4ll_pr1m3s}',
  },
  {
    name: 'AES ECB Byte at a Time',
    point: 350,
    max_attempts: 5,
    description: "**ECB** mode leaks information because identical plaintext blocks produce identical ciphertext blocks.\n\nIf you control an input that gets concatenated with a secret before encryption, you can recover the secret byte by byte.\n\nWrite a script to recover the flag from an ECB oracle.\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{3cb_byt3_4t_4_t1m3_4tt4ck}',
  },
  {
    name: 'Padding Oracle',
    point: 400,
    max_attempts: 5,
    description: "A **padding oracle** vulnerability allows decrypting ciphertexts without knowing the key.\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{p4dd1ng_0r4cl3_4tt4ck_m4st3r}',
  },
  {
    name: 'RSA Broadcast Attack',
    point: 400,
    max_attempts: 5,
    description: "**Håstad's broadcast attack**: if the same message is encrypted with three different public keys (all with e=3), you can recover the plaintext using the Chinese Remainder Theorem.\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{br04dc4st_4tt4ck_w1th_crt}',
  },
  {
    name: 'ECC Point Addition',
    point: 250,
    max_attempts: 5,
    description: "Elliptic curve cryptography on a small curve.\n\n**Curve:** `y² = x³ + 2x + 3 mod 97`\n**Generator G = (3, 6)**\n**Private key = 42**\nPublic key = 42 × G (scalar multiplication)\n\nCompute the **x-coordinate** of the public key. That number is the flag content.\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{83}',
  },
  {
    name: 'Fernet Encryption',
    point: 150,
    max_attempts: 5,
    description: "**Fernet** is a symmetric encryption scheme from the Python cryptography library. It uses AES-128-CBC with HMAC-SHA256.\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{f3rn3t_3ncrypt10n_1s_s3cur3}',
  },
  {
    name: 'One-Time Pad Reuse',
    point: 350,
    max_attempts: 5,
    description: "**Never reuse a one-time pad!** When two plaintexts are XOR-encrypted with the same key, XORing the ciphertexts cancels the key.\n\n---\n*Author: " + AUTHOR + "*",
    flag: 'JKKNIUCTF{n3v3r_r3us3_0tp_k3y_4g41n}',
  },
];

async function seed() {
  const existing = await Challenge.countDocuments({ contest_id: CONTEST_ID, category: CATEGORY });
  if (existing >= 20) {
    console.log(`${existing} crypto challenges already exist. Skipping.`);
    process.exit(0);
  }

  for (const ch of challenges) {
    const challenge = await Challenge.create({
      contest_id: CONTEST_ID,
      name: ch.name,
      description: ch.description,
      point: ch.point,
      max_attempts: ch.max_attempts,
      category: CATEGORY,
      visibility: 1,
    });

    await Flag.create({
      value: ch.flag,
      challenge_id: challenge._id,
      is_case_sensitive: false,
    });

    console.log(`Created: ${ch.name} (${ch.point}pts) -> ${ch.flag}`);
  }

  console.log(`\n✅ Created ${challenges.length} crypto challenges!`);
}

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ctf_hosting_website')
  .then(() => seed())
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
