// scripts/enable-totp.ts
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

initializeApp({
  credential: cert({
    projectId: "fursure-9e796",
    clientEmail:
 "firebase-adminsdk-fbsvc@fursure-9e796.iam.gserviceaccount.com",
     privateKey:
"-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDKVunM+wcxTxDP\nEvtUF5R1wj0YV/xoe2F0Rln+OfflM/oJolOyQBmsMu6CoDEdp4GpAP88BH4WBhTe\nJQx7y45sNaW4+MoSJrkvcj7eRjlzwaRXmGLRRYaQmrbG0FPzRwRKHo8HKhdfPo0y\np3sdIYlADwFvY6FjXJf25993NA6dTaAAvMTybjEqC/4cpFtKLr2nK/ld6Nbvu6So\n+O6I4vtTUUP14NWyVS1kx9QJSJCNKfLKKUWYfgTRNtN8yRuhsIHgUVXqrg8WZ+q9\ntFYeWSqpVwRVVhPNtJXQjFw+/SimiiYDcDD8ggl/dikZTnoKyvwRllSwpSevMOu6\nGFxlprtJAgMBAAECggEAKXHRfGC7qawsAXo+HAyjZlZ1nKejBgSlosMpOkNF5T72\n+2OyOIvcJlMdWwi0XsJZctRHM1QpPlobCqB0lOPOJZh8fC2LeFnRqyf/vBgOuwji\nIGYQcZSH2lUyVHlGBMnaVVM6kSlcNbBSjBpVg5NDsWkRbm8uFrPX1aVLdrdlOe9X\nm3c/YPqsRXQ9wpoEhPVXgA2RGl2uZgGHzE2TVhMeHuKhuuk/Dph7b6UM10VINb2f\nd5pKbnsYJzHJm2Dw/oPlaWr4xWwuCYNjqUSNsXT1NeCVbWzisBcrYvRF6zk28VTg\n4v/1JF69vNlVFuWTHdvHdGNnzW5qsZwdsg22G/jHfQKBgQD4aYmLsUD6zzutBomq\n5LGh7XP99yLkwwJ5J1PcIN3iKs7gZt/TAyesEDY2gDmjQ4x2o9InfxefmcQjXcNH\n9UuQANDKdB6fEY9af/LKLrQtakFlKb0CEuAfziCE2AAnNdk2fP7IQ6Jy0vjUMUE/\n4Zj3Jgq+5RqQGclUUvse+rn9DQKBgQDQhRwL1CTPykvAnCHnrZLg1lQD7WWyLfH4\njrmVo2lh6a5SHh7LcvdTJfXYqt0OtV9ZRlTKUQnGrTI+DmlJoZLkaab/SAdeetGN\nOGXZzS5PKbNb6toOIXOzmcIiRhpnmJ54l9y9q8dhjPqNCCduF3YubwuFm3Dh6TvC\n3JO6SfpALQKBgEMSQ8gK6O+PSp6SGFOjAe8lrN7SfoJjwOQzYSobWa16P3dJb3+K\n54hGrEyU3Hsffup9mv19DETUgKfH5jUknu1XuwgeyDHMzPbzevtqFs34VYXZ+iV4\nMTmFLzSPGaN8n5RdtXEfCdqU6gho8CQuZl280MPwGfb0b26sJQ+dROB1AoGAa93P\nylatzEfLtBGQgHaL2n9E6tstlmSqHXhHjJ8B7sKhiJ1INNp+Eqc6bCDHRcqRTm9R\ngW82bW4+5VczJAHPKRV2a+xo03kZWcJo/ahkYlMiE1SEBHdNkQTjJjO5iQmsQJne\neMeZ1l7FZZtoOk0st4x+G1lzpYmvfnf4e4+1QukCgYAGBpeyrlSbLSMqboCKbTIc\n4oEGKbCs4PEe16FKcoaPSOX2aMm/BCkEeO1wQKGJbWBrKOjTkhkraaei2J+Gr7Sg\nhlJSoB/VN1HLd6fXwCGQclzxUx0D8/ntDabPN3RqjMsQqYv/EbzUFuFRh4gAGiYK\n4zb7Jl96OVU/1edK428LTA==\n-----END PRIVATE KEY-----\n",  }),
});

async function enableTOTP() {
  try {
    await getAuth()
      .projectConfigManager()
      .updateProjectConfig({
        multiFactorConfig: {
          state: "ENABLED",
          providerConfigs: [
            {
              state: "ENABLED",
              totpProviderConfig: {
                adjacentIntervals: 2, // Adjust as needed
              },
            },
          ],
        },
      });
    console.log("✅ TOTP MFA enabled successfully!");
  } catch (error) {
    console.error("❌ Error enabling TOTP MFA:", error);
  }
}

enableTOTP();
