package com.chama.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SecureSessionStorage")
public class SecureSessionStoragePlugin extends Plugin {
    private static final String KEY_ALIAS = "chama360_session_key_v1";
    private static final String PREFS_NAME = "chama360_secure_session";
    private static final String ACCESS_TOKEN = "access_token";
    private static final String REFRESH_TOKEN = "refresh_token";
    private static final int GCM_TAG_BITS = 128;

    @PluginMethod
    public void setTokens(PluginCall call) {
        String accessToken = call.getString("accessToken");
        String refreshToken = call.getString("refreshToken");
        if (accessToken == null || refreshToken == null) {
            call.reject("Both accessToken and refreshToken are required");
            return;
        }

        try {
            preferences().edit()
                .putString(ACCESS_TOKEN, encrypt(accessToken))
                .putString(REFRESH_TOKEN, encrypt(refreshToken))
                .apply();
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to protect session tokens", error);
        }
    }

    @PluginMethod
    public void getTokens(PluginCall call) {
        String encryptedAccess = preferences().getString(ACCESS_TOKEN, null);
        String encryptedRefresh = preferences().getString(REFRESH_TOKEN, null);
        JSObject result = new JSObject();

        if (encryptedAccess == null || encryptedRefresh == null) {
            result.put("accessToken", JSObject.NULL);
            result.put("refreshToken", JSObject.NULL);
            call.resolve(result);
            return;
        }

        try {
            result.put("accessToken", decrypt(encryptedAccess));
            result.put("refreshToken", decrypt(encryptedRefresh));
            call.resolve(result);
        } catch (Exception error) {
            preferences().edit().clear().apply();
            call.reject("Stored session could not be decrypted", error);
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        preferences().edit().clear().apply();
        call.resolve();
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build());
        return generator.generateKey();
    }

    private String encrypt(String plaintext) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        return Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "." + Base64.encodeToString(ciphertext, Base64.NO_WRAP);
    }

    private String decrypt(String encoded) throws Exception {
        String[] parts = encoded.split("\\.", 2);
        if (parts.length != 2) throw new IllegalArgumentException("Invalid encrypted value");
        byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
        byte[] ciphertext = Base64.decode(parts[1], Base64.NO_WRAP);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
        return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    }
}
