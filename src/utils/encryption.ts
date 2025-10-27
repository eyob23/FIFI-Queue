import CryptoJS from "crypto-js";

// Use a fixed key for demo purposes - in production, this should be securely managed
const ENCRYPTION_KEY = "secure-form-data-key-2024";

export const encryptData = (data: any): string => {
  try {
    const jsonString = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(
      jsonString,
      ENCRYPTION_KEY
    ).toString();
    return encrypted;
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Failed to encrypt data");
  }
};

export const decryptData = <T = any>(encryptedData: string): T => {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);

    if (!jsonString) {
      throw new Error("Failed to decrypt data - invalid encrypted string");
    }

    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt data");
  }
};
